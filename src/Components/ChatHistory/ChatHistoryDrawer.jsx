import { Drawer, DrawerContent, DrawerOverlay } from "@chakra-ui/react";
import ChatHistorySidebar from "./ChatHistorySidebar";

const ChatHistoryDrawer = ({
  isOpen,
  onClose,
  currentAccount,
  conversations,
  setChatOpenAddress,
  toggleSendNewMsgButtonClicked,
}) => {
  return (
    <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
      <DrawerOverlay>
        <DrawerContent>
          <ChatHistorySidebar
            currentAccount={currentAccount}
            conversations={conversations}
            setChatOpenAddress={setChatOpenAddress}
            toggleSendNewMsgButtonClicked={toggleSendNewMsgButtonClicked}
          />
        </DrawerContent>
      </DrawerOverlay>
    </Drawer>
  );
};

export default ChatHistoryDrawer;
