// src/app/home/page.tsx
import AppLayout from '@/components/AppLayout';
import HomeClient from '@/components/HomeClient';

export default function HomePage() {
  return (
    <AppLayout>
      <HomeClient />
    </AppLayout>
  );
}