// src/app/chat/page.tsx
import AppLayout from '@/components/AppLayout';
import ChatClient from '@/components/ChatClient';

export default function ChatPage() {
  return (
    <AppLayout>
      <ChatClient />
    </AppLayout>
  );
}