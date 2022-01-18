import * as React from "react";
import { ethers } from "ethers";
import { encrypt, decrypt } from "@metamask/eth-sig-util";
import * as nacl from "tweetnacl";
import * as naclUtil from "tweetnacl-util";
import EmailContractABI from "./Contracts/Email.json";
import Chat from "./Components/Chat";
import ChatHistorySidebar from "./Components/ChatHistory/ChatHistorySidebar";
import ChatHistoryDrawer from "./Components/ChatHistory/ChatHistoryDrawer";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  Textarea,
  UnorderedList,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";

const EmailContractAddress = "0xe5a3f67397979287fE4134FD25e94158CfE29296";
let provider;
let emailContract;

function App() {
  const {
    isOpen: isDecryptModalOpen,
    onOpen: onDecryptModalOpen,
    onClose: onDecryptModalClose,
  } = useDisclosure();
  const {
    isOpen: isChatHistoryOpen,
    onOpen: onChatHistoryOpen,
    onClose: onChatHistoryClose,
  } = useDisclosure();
  const [currentAccount, setCurrentAccount] = React.useState("");
  const [isRegistered, setIsRegistered] = React.useState(false);
  const [keyPair, setKeyPair] = React.useState(null);
  const [conversations, _setConversations] = React.useState({});
  const conversationsRef = React.useRef(conversations);
  const [isSendNewMsgButtonClicked, toggleSendNewMsgButtonClicked] =
    React.useState(false);
  const [chatOpenAddress, setChatOpenAddress] = React.useState("");
  const [newToAddress, setNewToAddress] = React.useState("");
  const [newSendMessage, setNewSendMessage] = React.useState("");

  const setConversations = (data) => {
    conversationsRef.current = data;
    _setConversations(data);
  };

  const encryptFromPublicKey = (publicKey, message) => {
    return ethers.utils.hexlify(
      Buffer.from(
        JSON.stringify(
          encrypt({
            publicKey: publicKey,
            data: message,
            version: "x25519-xsalsa20-poly1305",
          })
        ),
        "utf8"
      )
    );
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      console.warn(
        "please install metamask or any other ethereum software wallet!"
      );
      return;
    }

    await window.ethereum
      .request({ method: "eth_requestAccounts" })
      .then((accounts) => {
        if (accounts.length > 0) {
          console.log(`Connected with ${accounts[0]}!`);
          setCurrentAccount(accounts[0]);
        } else {
          console.log("No Account found to establish connection!");
          return;
        }
      })
      .catch((err) => console.error(err));
  };

  const registerUser = async () => {
    console.log("Register button clicked!");
    await window.ethereum
      .request({
        method: "eth_getEncryptionPublicKey",
        params: [currentAccount],
      })
      .then((publicKey) => {
        let _keyPair = nacl.box.keyPair();
        _keyPair.secretKey = naclUtil.encodeBase64(_keyPair.secretKey);
        _keyPair.publicKey = naclUtil.encodeBase64(_keyPair.publicKey);
        _keyPair.encryptedPrivateKey = encryptFromPublicKey(
          publicKey,
          _keyPair.secretKey
        );

        const register = async () => {
          const txn = await emailContract.register(
            _keyPair.encryptedPrivateKey,
            _keyPair.publicKey
          );
          await txn.wait();
          setKeyPair(_keyPair);
          setIsRegistered(!isRegistered);
        };
        register();
      })
      .catch((err) => console.error(err));
  };

  const sendNewMessage = async (toAddress, message) => {
    const isToRegistered = await emailContract.isRegistered(toAddress);
    if (isToRegistered) {
      const toPubKey = await emailContract.getPubKey(toAddress);

      const encryptedMessage = {
        timestamp: `${Date.now()}`,
        from: encryptFromPublicKey(keyPair.publicKey, message),
        to: encryptFromPublicKey(toPubKey, message),
      };
      const txn = await emailContract.sendMail(
        toAddress,
        keyPair.publicKey,
        toPubKey,
        JSON.stringify(encryptedMessage)
      );
      await txn.wait();

      const msgArray = conversations.hasOwnProperty(toAddress) ? conversations[toAddress] : [];
      msgArray.push({
        timestamp: encryptedMessage.timestamp,
        event: "sender",
        message: message
      });
      const tmpConvo = { ...conversations };
      tmpConvo[toAddress] = msgArray;
      setConversations(tmpConvo);
    } else {
      alert("you are trying to send a message to an unregistered address!!");
    }
    toggleSendNewMsgButtonClicked(false);
  };

  const sendNewMessageWrapper = async (newMessage) => {
    await sendNewMessage(chatOpenAddress, newMessage);
  };

  React.useEffect(() => {
    const checkIfWalletIsConnected = async () => {
      if (!window.ethereum) {
        console.warn(
          "please install metamask or any other ethereum software wallet!"
        );
        return;
      }

      window.ethereum.on("accountsChanged", (_) => window.location.reload());
      window.ethereum.on("chainChanged", (_) => window.location.reload());

      provider = new ethers.providers.Web3Provider(window.ethereum);
      emailContract = new ethers.Contract(
        EmailContractAddress,
        EmailContractABI.abi,
        provider.getSigner()
      );
      await window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts.length > 0) {
            console.log(`Authorized Account Found: ${accounts[0]}`);
            setCurrentAccount(accounts[0]);
          } else {
            console.log("No Authorized Account Found!");
            return;
          }
        })
        .catch((err) => console.error(err));
    };

    checkIfWalletIsConnected();
  }, []);

  React.useEffect(() => {
    if (!currentAccount) {
      return;
    }

    const checkIfAddressIsRegistered = async (address) => {
      await emailContract
        .isRegistered(address)
        .then((_isRegistered) => setIsRegistered(_isRegistered))
        .catch((err) => console.error(err));
    };
    checkIfAddressIsRegistered(currentAccount);
  }, [currentAccount]);

  React.useEffect(() => {
    if (!isRegistered || keyPair !== null) {
      return;
    }
    onDecryptModalOpen();

    // get private key from contract
    const getSecretKey = async () => {
      try {
        const encSecretKey = await emailContract.getEncrPrivKey();
        // const secretKey = "RaNYTrEE6HY41QAUvrNSUj5yPBHeKUkbOuLCsAKu26I=";
        const secretKey = await window.ethereum.request({
          method: "eth_decrypt",
          params: [encSecretKey, currentAccount],
        });
        const _keyPair = nacl.box.keyPair.fromSecretKey(
          naclUtil.decodeBase64(secretKey)
        );
        _keyPair.secretKey = naclUtil.encodeBase64(_keyPair.secretKey);
        _keyPair.publicKey = naclUtil.encodeBase64(_keyPair.publicKey);
        setKeyPair(_keyPair);
        onDecryptModalClose();
      } catch (err) {
        if (err.code === 4001) {
          console.error("user cancelled the decrypt request");
          // TODO: create https://chakra-ui.com/docs/feedback/alert and ask user to refresh.
        } else {
          console.error(err);
        }
        return;
      }
    };

    getSecretKey();
  }, [isRegistered]);

  React.useEffect(() => {
    if (keyPair === null || isSendNewMsgButtonClicked) {
      return;
    }

    const contractEventListerner = async () => {
      emailContract.on("Mail", (from, to, encryptedMessage, event) => {
        if (to.toLowerCase() === currentAccount.toLowerCase()) {
          const fromAddress = from.toLowerCase();
          encryptedMessage = JSON.parse(encryptedMessage);
          const msgArray = conversationsRef.current.hasOwnProperty(fromAddress)
            ? JSON.parse(JSON.stringify(conversationsRef.current[fromAddress]))
            : [];
          msgArray.push({
            timestamp: encryptedMessage.timestamp,
            event: "receiver",
            message: decrypt({
              encryptedData: JSON.parse(
                Buffer.from(
                  ethers.utils.arrayify(encryptedMessage.to)
                ).toString()
              ),
              privateKey: naclUtil.decodeBase64(keyPair.secretKey),
            }),
          });
          const tmpConvo = { ...conversationsRef.current };
          tmpConvo[fromAddress] = msgArray;
          setConversations(tmpConvo);
        }
      });
    };

    // get all conversations
    const fetchConversations = async () => {
      try {
        const convo = {};
        const sentMailFilter = emailContract.filters.Mail(currentAccount);
        const sentMailEvents = await emailContract.queryFilter(sentMailFilter);
        // console.log(sentMailEvents);
        sentMailEvents.forEach((event) => {
          event = event.args;
          const toAddress = event.to.toLowerCase();
          const encryptedMessage = JSON.parse(event.encryptedMessage);
          const msgArray = !convo.hasOwnProperty(toAddress)
            ? []
            : convo[toAddress];
          msgArray.push({
            timestamp: encryptedMessage.timestamp,
            event: "sender",
            message: decrypt({
              encryptedData: JSON.parse(
                Buffer.from(
                  ethers.utils.arrayify(encryptedMessage.from)
                ).toString()
              ),
              privateKey: naclUtil.decodeBase64(keyPair.secretKey),
            }),
          });
          convo[toAddress] = msgArray;
        });

        const receivedMailFilter = emailContract.filters.Mail(
          null,
          currentAccount
        );
        const receivedMailEvents = await emailContract.queryFilter(
          receivedMailFilter
        );
        // console.log(receivedMailEvents);
        receivedMailEvents.forEach((event) => {
          event = event.args;
          const fromAddress = event.from.toLowerCase();
          const encryptedMessage = JSON.parse(event.encryptedMessage);
          const msgArray = !convo.hasOwnProperty(fromAddress)
            ? []
            : convo[fromAddress];
          msgArray.push({
            timestamp: encryptedMessage.timestamp,
            event: "receiver",
            message: decrypt({
              encryptedData: JSON.parse(
                Buffer.from(
                  ethers.utils.arrayify(encryptedMessage.to)
                ).toString()
              ),
              privateKey: naclUtil.decodeBase64(keyPair.secretKey),
            }),
          });
          convo[fromAddress] = msgArray;
        });

        // console.log(convo);
        Object.keys(convo).forEach((key) => {
          const messages = convo[key];
          messages.sort((a, b) => a.timestamp - b.timestamp);
          convo[key] = messages;
        });
        setConversations(convo);
      } catch (err) {
        console.error(err);
      }
    };
    fetchConversations();
    contractEventListerner();
  }, [keyPair, isSendNewMsgButtonClicked]);

  const RenderContent = () => {
    if (currentAccount === "") {
      return (
        <VStack spacing={4} px={6}>
          <Text>
            To use you must connect with <Text as="em">Metamask</Text> software
            wallet!
          </Text>
          <Button onClick={connectWallet}>Connect Wallet</Button>
        </VStack>
      );
    } else if (!isRegistered) {
      return (
        <VStack spacing={4} px={6}>
          <Text>Registration is a one time process.</Text>
          <UnorderedList fontSize="sm">
            <ListItem>
              please provide your <Text as="i">encrypted</Text> public key to
              encrypt all incoming and outgoing messages
            </ListItem>
            <ListItem>
              sign a transaction to store provided public key for others to send
              you encrypted messages
            </ListItem>
          </UnorderedList>
          <Button onClick={registerUser}>Register</Button>
        </VStack>
      );
    } else if (!keyPair) {
      return (
        <Modal
          closeOnOverlayClick={false}
          isOpen={isDecryptModalOpen}
          onClose={null}
          isCentered
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Decrypt Messages</ModalHeader>
            <ModalBody textAlign="center" pb={6}>
              <Text>
                you will receive a metamask notification, please click on{" "}
                <Text as="i">decrypt</Text> to view all your messages!
              </Text>
              <Spinner />
            </ModalBody>
          </ModalContent>
        </Modal>
      );
    } else if (!isSendNewMsgButtonClicked) {
      return (
        <HStack h="80vh" spacing={0} px={4}>
          <Flex
            as="aside"
            h="full"
            maxW={{ base: "xs", xl: "sm" }}
            display={{ base: "none", lg: "flex" }}
            w="full"
            borderColor="black.100"
            borderWidth={1}
          >
            <ChatHistorySidebar
              currentAccount={currentAccount}
              conversations={conversations}
              setChatOpenAddress={setChatOpenAddress}
              toggleSendNewMsgButtonClicked={toggleSendNewMsgButtonClicked}
            />
          </Flex>
          <Flex
            as="main"
            h="full"
            flex={1}
            borderColor="black.100"
            borderWidth={1}
          >
            <Chat
              chatOpenAddress={chatOpenAddress}
              messages={
                conversations.hasOwnProperty(chatOpenAddress)
                  ? conversations[chatOpenAddress]
                  : []
              }
              onChatHistoryOpen={onChatHistoryOpen}
              sendNewMessage={sendNewMessageWrapper}
            />
          </Flex>

          <ChatHistoryDrawer
            isOpen={isChatHistoryOpen}
            onClose={onChatHistoryClose}
            currentAccount={currentAccount}
            conversations={conversations}
            setChatOpenAddress={setChatOpenAddress}
            toggleSendNewMsgButtonClicked={toggleSendNewMsgButtonClicked}
          />
        </HStack>
      );
    } else if (isSendNewMsgButtonClicked) {
      return (
        <Modal
          isOpen={isSendNewMsgButtonClicked}
          onClose={() => {
            setNewToAddress("");
            setNewSendMessage("");
            toggleSendNewMsgButtonClicked(false);
          }}
          isCentered
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Send New Message</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <FormControl>
                <FormLabel>to</FormLabel>
                <Input
                  value={newToAddress}
                  onChange={(e) => setNewToAddress(e.target.value)}
                  placeholder="0x0000..."
                />
              </FormControl>

              <FormControl mt={4}>
                <FormLabel>message</FormLabel>
                <Textarea
                  value={newSendMessage}
                  onChange={(e) => setNewSendMessage(e.target.value)}
                  placeholder="Type your message"
                />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button
                colorScheme="blue"
                mr={3}
                disabled={newToAddress.length !== 42 || !newSendMessage}
                onClick={async (e) => {
                  e.preventDefault();
                  await sendNewMessage(newToAddress, newSendMessage);
                  setNewToAddress("");
                  setNewSendMessage("");
                }}
              >
                Send
              </Button>
              <Button
                onClick={() => {
                  setNewToAddress("");
                  setNewSendMessage("");
                  toggleSendNewMsgButtonClicked(false);
                }}
              >
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      );
    }
  };

  return (
    <Box h="100vh" maxH="100vh" p={3}>
      <Heading textAlign="center" my={4}>
        pigeon
      </Heading>
      {RenderContent()}
    </Box>
  );
}

export default App;
