import { Box, Flex, Heading, Text, VStack } from "@chakra-ui/react";
import Blockies from "react-blockies";

const ChatRow = ({ from, message, timestamp }) => {
  return (
    <Flex
      py={4}
      px={4}
      w="full"
      alignItems="center"
      borderBottomColor="black.100"
      borderBottomWidth={1}
      style={{ transition: "background 300ms" }}
      _hover={{ bg: "blue.900", cursor: "pointer" }}
    >
      <Box rounded="full" minW={10} minH={10} >
        <Blockies seed={from.toLowerCase()} size={10} />
      </Box>
      <VStack
        overflow="hidden"
        flex={1}
        ml={3}
        spacing={0}
        alignItems="flex-start"
        textAlign="justify"
      >
        <Heading fontSize={12} w="full">
          {from}
        </Heading>
        <Text
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          w="full"
          fontSize="xs"
          color="gray.500"
        >
          {message}
        </Text>
      </VStack>
      <Text ml={3} fontSize="xs" color="gray.500">
        {new Date((timestamp / 1000) * 1000).toLocaleTimeString()}
      </Text>
    </Flex>
  );
};

export default ChatRow;
