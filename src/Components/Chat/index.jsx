import {
  Flex,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { IoSend } from "react-icons/io5";
import { HiChat } from "react-icons/hi";
import ChatBubble from "./ChatBubble";
import { useState } from "react";

const Chat = ({ chatOpenAddress, messages, onChatHistoryOpen, sendNewMessage }) => {
  const [newMsg, setNewMsg] = useState("");
  messages.sort((a, b) => a.timestamp - b.timestamp);
  return (
    <Flex w="full" flexDirection="column">
      <HStack p={4} borderBottomColor="black.100" borderBottomWidth={1}>
        <IconButton
          onClick={onChatHistoryOpen}
          display={{ base: "inherit", lg: "none" }}
          icon={<HiChat />}
          aria-label="Toggle Chat History Drawer"
        />
        <VStack w="full">
          <Text as="b">{chatOpenAddress}</Text>
        </VStack>
      </HStack>
      <Flex px={6} overflowY="auto" flexDirection="column" flex={1}>
        {messages.map(({ message, event, timestamp }, index) => (
          <ChatBubble
            key={index}
            message={message}
            from={event}
            dateSent={new Date((timestamp / 1000) * 1000).toLocaleString()}
          />
        ))}
      </Flex>
      <Flex pl={4} pr={2} py={2} borderTopColor="black.100" borderTopWidth={1}>
        <Input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          variant="unstyled"
          placeholder="Type your message"
        />
        <IconButton
          colorScheme="cyan"
          aria-label="Send message"
          variant="ghost"
          icon={<IoSend />}
          disabled={chatOpenAddress.length !== 42 || !newMsg}
          onClick={async () => {
            await sendNewMessage(newMsg);
            setNewMsg("");
          }}
        />
      </Flex>
    </Flex>
  );
};

export default Chat;
