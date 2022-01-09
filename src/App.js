import * as React from 'react';
import { ethers } from 'ethers';
import { encrypt, decrypt } from '@metamask/eth-sig-util';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import EmailContractABI from './Contracts/Email.json';
import './App.css';

const EmailContractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
let provider;
let emailContract;

function App() {
  const [currentAccount, setCurrentAccount] = React.useState("");
  const [isRegistered, setIsRegistered] = React.useState(false);
  const [keyPair, setKeyPair] = React.useState(null);
  const [conversations, setConversations] = React.useState({});
  const [isSendNewMsgButtonClicked, toggleSendNewMsgButtonClicked] = React.useState(false);
  const [newToAddress, setNewToAddress] = React.useState("");
  const [newSendMessage, setNewSendMessage] = React.useState("");

  const encryptFromPublicKey = (publicKey, message) => {
    return ethers.utils.hexlify(Buffer.from(JSON.stringify(encrypt({
      publicKey: publicKey,
      data: message,
      version: 'x25519-xsalsa20-poly1305'
    })), 'utf8'));
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      console.warn("please install metamask or any other ethereum software wallet!");
      return;
    }

    await window.ethereum
      .request({ method: 'eth_requestAccounts' })
      .then(accounts => {
        if (accounts.length > 0) {
          console.log(`Connected with ${accounts[0]}!`);
          setCurrentAccount(accounts[0]);
        } else {
          console.log("No Account found to establish connection!");
          return;
        }
      })
      .catch(err => console.error(err));
  }

  const registerUser = async () => {
    console.log("Register button clicked!");
    await window.ethereum
      .request({
        method: 'eth_getEncryptionPublicKey',
        params: [currentAccount]
      })
      .then((publicKey) => {
        let _keyPair = nacl.box.keyPair();
        _keyPair.secretKey = naclUtil.encodeBase64(_keyPair.secretKey);
        _keyPair.publicKey = naclUtil.encodeBase64(_keyPair.publicKey);
        _keyPair.encryptedPrivateKey = encryptFromPublicKey(publicKey, _keyPair.secretKey);
        
        const register = async () => {
          const txn = await emailContract.register(_keyPair.encryptedPrivateKey, _keyPair.publicKey);
          await txn.wait();
          setKeyPair(_keyPair);
          setIsRegistered(!isRegistered);
        }
        register();
      })
      .catch(err => console.error(err));
  };

  const sendNewMessage = async () => {
    const isToRegistered = await emailContract.isRegistered(newToAddress);
    if (isToRegistered) {
      const toPubKey = await emailContract.getPubKey(newToAddress);

      const encryptedMessages = {
        "timestamp": `${Date.now()}`,
        "from": encryptFromPublicKey(keyPair.publicKey, newSendMessage),
        "to": encryptFromPublicKey(toPubKey, newSendMessage)
      }
      const txn = await emailContract.sendMail(newToAddress, keyPair.publicKey, toPubKey, JSON.stringify(encryptedMessages));
      await txn.wait();

      setNewToAddress("");
      setNewSendMessage("");
    } else {
      alert("address you are trying to send the message is not registered!!");
    }
    toggleSendNewMsgButtonClicked(!isSendNewMsgButtonClicked);
  };

  React.useEffect(() => {
    const checkIfWalletIsConnected = async () => {
      if (!window.ethereum) {
        console.warn("please install metamask or any other ethereum software wallet!");
        return;
      }
  
      provider = new ethers.providers.Web3Provider(window.ethereum);
      emailContract = new ethers.Contract(EmailContractAddress, EmailContractABI.abi, provider.getSigner());
      await window.ethereum
        .request({ method: 'eth_accounts' })
        .then(accounts => {
          if (accounts.length > 0) {
            console.log(`Authorized Account Found: ${accounts[0]}`);
            setCurrentAccount(accounts[0]);
          } else {
            console.log("No Authorized Account Found!");
            return;
          }
        })
        .catch(err => console.error(err));
    };

    checkIfWalletIsConnected();
  }, []);

  React.useEffect(() => {
    if (!currentAccount) {
      return;
    }

    const checkIfAddressIsRegistered = async (address) => {
      await emailContract.isRegistered(address)
        .then(_isRegistered => setIsRegistered(_isRegistered))
        .catch(err => console.error(err));
    };
    checkIfAddressIsRegistered(currentAccount);
  }, [currentAccount]);

  React.useEffect(() => {
    if (!isRegistered || keyPair !== null) {
      return;
    }

    // get private key from contract
    const getSecretKey = async () => {
      try {
        const encSecretKey = await emailContract.getEncrPrivKey();
        const secretKey = await window.ethereum.request({
          method: 'eth_decrypt',
          params: [encSecretKey, currentAccount]
        });
        const _keyPair = nacl.box.keyPair.fromSecretKey(naclUtil.decodeBase64(secretKey))
        _keyPair.secretKey = naclUtil.encodeBase64(_keyPair.secretKey);
        _keyPair.publicKey = naclUtil.encodeBase64(_keyPair.publicKey);
        setKeyPair(_keyPair);
      } catch (err) {
        console.error(err);
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
        if (to.toLowerCase() == currentAccount.toLowerCase()) {
          console.log(`{
            from: ${from},
            to: ${to},
            encryptedMessage: ${encryptedMessage}
          }`);
          encryptedMessage = JSON.parse(encryptedMessage);
          const _conversations = conversations;
          const msgArray = !_conversations.hasOwnProperty(from) ? [] : _conversations[from];
          msgArray.push({
            timestamp: encryptedMessage.timestamp,
            event: "receiver",
            message: decrypt({
              encryptedData: JSON.parse(Buffer.from(ethers.utils.arrayify(encryptedMessage.to)).toString()),
              privateKey: naclUtil.decodeBase64(keyPair.secretKey)
            })
          });
          _conversations[from] = msgArray;
          setConversations(_conversations);
        }
      });
    };
    contractEventListerner();

    // get all conversations
    const fetchConversations = async () => {
      try {
        const convo = {};
        const sentMailFilter = emailContract.filters.Mail(currentAccount);
        const sentMailEvents = await emailContract.queryFilter(sentMailFilter);
        console.log(sentMailEvents);
        sentMailEvents.forEach(event => {
          event = event.args;
          const encryptedMessage = JSON.parse(event.encryptedMessage);
          const msgArray = !convo.hasOwnProperty(event.to) ? [] : convo[event.to];
          msgArray.push({
            timestamp: encryptedMessage.timestamp,
            event: "sender",
            message: decrypt({
              encryptedData: JSON.parse(Buffer.from(ethers.utils.arrayify(encryptedMessage.from)).toString()),
              privateKey: naclUtil.decodeBase64(keyPair.secretKey)
            })
          });
          convo[event.to] = msgArray;
        });

        const receivedMailFilter = emailContract.filters.Mail(null, currentAccount);
        const receivedMailEvents = await emailContract.queryFilter(receivedMailFilter);
        console.log(receivedMailEvents);
        receivedMailEvents.forEach(event => {
          event = event.args;
          const encryptedMessage = JSON.parse(event.encryptedMessage);
          const msgArray = !convo.hasOwnProperty(event.from) ? [] : convo[event.from];
          msgArray.push({
            timestamp: encryptedMessage.timestamp,
            event: "receiver",
            message: decrypt({
              encryptedData: JSON.parse(Buffer.from(ethers.utils.arrayify(encryptedMessage.to)).toString()),
              privateKey: naclUtil.decodeBase64(keyPair.secretKey)
            })
          });
          convo[event.from] = msgArray;
        });

        console.log(convo);
        setConversations(convo);
      } catch (err) {
        console.error(err);
      }
    };
    fetchConversations();
  }, [keyPair, isSendNewMsgButtonClicked]);

  return (
    <div>
      {currentAccount && isRegistered ? (
        <>
          <div className="App">
            <h1>Web3Mail</h1>
          </div>
          <div className="App">
            {isSendNewMsgButtonClicked ? (
              <>
                <div>
                  <label>To:</label>
                  <input
                    type="text"
                    name="to"
                    placeholder="0x000..."
                    value={newToAddress}
                    onInput={e => setNewToAddress(e.target.value)}
                  />
                </div>
                <br />
                <div>
                  <label>Message:</label>
                  <input
                    type="text"
                    name="message"
                    placeholder="Type your message here..."
                    value={newSendMessage}
                    onInput={e => setNewSendMessage(e.target.value)}
                  />
                </div>
                <br />
                <button className="SendNewMessage" onClick={sendNewMessage} disabled={newToAddress.length !== 42 || !newSendMessage}>
                  Send
                </button>
              </>
            ) : (
              // show all conversations here
              <div>
                <ul>
                  {Object.keys(conversations).map((key, index) => (
                    <li key={index}>{key}
                      <ul>
                        {conversations[key].sort((a, b) => a.timestamp - b.timestamp).map((msg, subIndex) => 
                          <li key={index + '' + subIndex}>{msg.message}</li>
                        )}
                      </ul>
                    </li>
                  ))}
                </ul>
                {/* <br /> */}
                <button className="SendNewMessage" onClick={() => toggleSendNewMsgButtonClicked(!isSendNewMsgButtonClicked)}>
                  Send New Message
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="App">
            <h1>Welcome to Web3Mail!</h1>
          </div>
          <div className="App">
            {!currentAccount ? (
              <button className="ConnectBtn" onClick={connectWallet}>
                Connect Wallet
              </button>
            ) : !isRegistered && (
              <button className="ConnectBtn" onClick={registerUser}>
                Register
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
