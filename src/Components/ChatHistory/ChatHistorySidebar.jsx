import {
  VStack,
  Flex,
  Box,
  Input,
  List,
  ListItem,
  IconButton,
  Spacer,
  Icon,
} from "@chakra-ui/react";
import { MdChatBubbleOutline } from "react-icons/md";
import Blockies from "react-blockies";
import ChatRow from "./ChatRow";

const ChatHistorySidebar = ({
  currentAccount,
  conversations,
  setChatOpenAddress,
  toggleSendNewMsgButtonClicked,
}) => {
  return (
    <VStack h="full" alignItems="center" w="full">
      <Flex
        w="full"
        p={4}
        borderBottomColor="black.100"
        borderBottomWidth={1}
        alignItems="center"
      >
        <Box rounded="full" minW={10} minH={10}>
          <Icon as={Blockies} seed={currentAccount.toLowerCase()} size={10} />
        </Box>
        <Spacer />
        <IconButton
          aria-label="start new chat"
          icon={<MdChatBubbleOutline />}
          mr={2}
          onClick={() => toggleSendNewMsgButtonClicked(true)}
        />
      </Flex>
      <Box w="full">
        <Input
          variant="filled"
          minH={10}
          rounded="full"
          placeholder="Search chat"
        />
      </Box>
      <Box
        w="full"
        overflowY="auto"
        borderTopColor="black.100"
        borderTopWidth={1}
      >
        <List w="full" spacing={0}>
          {Object.keys(conversations).map((from, index) => (
            <ListItem
              key={index}
              w="inherit"
              as="button"
              onClick={() => setChatOpenAddress(from)}
            >
              <ChatRow
                from={from}
                message={
                  conversations[from][conversations[from].length - 1]["message"]
                }
                timestamp={
                  conversations[from][conversations[from].length - 1][
                    "timestamp"
                  ]
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </VStack>
  );
};

export default ChatHistorySidebar;
