// app/people/page.tsx
import AppLayout from '@/components/AppLayout';
import PeopleClient from '@/components/PeopleClient';

export default function PeoplePage() {
  return (
    <AppLayout>
      <PeopleClient />
    </AppLayout>
  );
}