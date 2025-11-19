// src/app/people/page.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/AppLayout'
// --- NEW: Added 'X' icon ---
import { Search, UserPlus, MessageCircle, Check, Clock, X } from 'lucide-react' 
import { useAuth } from '@/context/UserContext'
import ToastNotification from '@/components/ToastNotification'
import { useRouter } from 'next/navigation'

const API_URL = 'http://localhost:3001';

type User = {
  user_id: number;
  full_name: string;
  role: string;
  graduation_year: string | null;
  department_name: string | null;
  headline: string | null;
  connection_status: 'pending' | 'accepted' | null;
  connection_sender_id: number | null;
  connection_id: number | null; 
};

type Department = {
  department_id: number;
  name: string;
};

// --- UPDATED: User Card Component ---
const UserCard = ({ user, myId, onConnect, onAccept, onReject, onMessage }: { 
  user: User; 
  myId: number; 
  onConnect: (userId: number) => void;
  onAccept: (connectionId: number) => void;
  onReject: (connectionId: number) => void; // <-- NEW
  onMessage: (connectionId: number) => void;
}) => {
  const headline = user.headline 
    ? user.headline 
    : (user.role === 'Student' ? `${user.department_name || 'Student'}` : user.role);

  const renderButton = () => {
    const { connection_status, connection_sender_id, user_id, connection_id } = user;

    if (connection_status === 'accepted') {
      return (
        <button 
          onClick={() => onMessage(connection_id!)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
          <MessageCircle className="w-4 h-4" />
          Message
        </button>
      );
    }

    if (connection_status === 'pending') {
      if (connection_sender_id === myId) {
        // I sent the request
        return (
          <div className="flex items-center gap-2">
            <button disabled className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 disabled:opacity-70">
              <Clock className="w-4 h-4" />
              Pending
            </button>
            <button 
              onClick={() => onMessage(connection_id!)}
              className="flex-shrink-0 p-3 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              title="Message"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </div>
        );
      } else {
        // --- THIS IS THE FIX ---
        // They sent me the request. Show 3 icon buttons.
        return (
          <div className="flex items-center justify-center gap-3">
            <button 
              onClick={() => onReject(connection_id!)}
              className="p-3 bg-red-100 text-red-600 rounded-full hover:bg-red-200 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800"
              title="Reject"
            >
              <X className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onMessage(connection_id!)}
              className="p-3 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              title="Message"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onAccept(connection_id!)}
              className="p-3 bg-green-100 text-green-600 rounded-full hover:bg-green-200 dark:bg-green-900 dark:text-green-400 dark:hover:bg-green-800"
              title="Accept"
            >
              <Check className="w-5 h-5" />
            </button>
          </div>
        );
        // --- END OF FIX ---
      }
    }

    return (
      <button 
        onClick={() => onConnect(user_id)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
      >
        <UserPlus className="w-4 h-4" />
        Connect
      </button>
    );
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col justify-between">
      <div>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
            {user.full_name[0]}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{user.full_name}</h3>
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">{user.role}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 min-h-[40px]">
          {headline}
        </p>
      </div>
      <div className="mt-4">
        {renderButton()}
      </div>
    </div>
  );
};

// --- UPDATED: Page Content Component ---
function PeoplePageContent() {
  const { user: loggedInUser } = useAuth(); 
  const router = useRouter(); 

  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [roleFilter, setRoleFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [passingYear, setPassingYear] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const totalPages = Math.ceil(totalUsers / limit);

  const clearMessages = () => { setError(null); setMessage(null); };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null); 
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((currentPage - 1) * limit),
        search: searchQuery,
        role: roleFilter,
        passingYear: passingYear,
        yearOfStudy: yearOfStudy,
        dept: deptFilter, 
      });

      const res = await fetch(`${API_URL}/api/people?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data.users);
      setTotalUsers(data.total);

    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [currentPage, limit, searchQuery, roleFilter, passingYear, yearOfStudy, deptFilter]);

  // Fetch Departments
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!loggedInUser?.college_id) return; 
      try {
        const res = await fetch(`${API_URL}/api/public/departments/${loggedInUser.college_id}`);
        if (!res.ok) throw new Error('Failed to load departments');
        const data = await res.json();
        setDepartments(data);
      } catch (err: any) {
        console.error(err.message);
      }
    };
    fetchDepartments();
  }, [loggedInUser]); 

  // Re-fetch users when filters or page change
  useEffect(() => {
    if (loggedInUser) { 
      fetchUsers();
    }
  }, [loggedInUser, fetchUsers]);

  // Handle Connect Button
  const handleConnect = async (receiverId: number) => {
    clearMessages();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/connections/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ receiverId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send request.');

      setMessage(data.message);
      fetchUsers(); 
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle Accept Button
  const handleAccept = async (connectionId: number) => {
    clearMessages();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/connections/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ connectionId, response: 'accepted' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept request.');

      setMessage(data.message); 
      fetchUsers(); 

    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- NEW: Handle Reject Button ---
  const handleReject = async (connectionId: number) => {
    clearMessages();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/connections/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ connectionId, response: 'rejected' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject request.');

      setMessage(data.message); 
      fetchUsers(); // Refresh the list

    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle Message Button
  const handleMessage = (connectionId: number) => {
    router.push(`/chat?open=${connectionId}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">People Directory</h1>

      {/* --- Search & Filter Bar (Same as before) --- */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          <div className="md:col-span-2 relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search by Name
            </label>
            <Search className="absolute left-3 top-9 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for students, alumni, or faculty..."
              className="w-full pl-10 pr-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filter by Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full py-2 px-3 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="all">All Roles</option>
              <option value="Student">Student</option>
              <option value="Alumni">Alumni</option>
              <option value="Faculty">Faculty</option>
              <option value="HOD">HOD</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-dept" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filter by Department
            </label>
            <select
              id="filter-dept"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              disabled={departments.length === 0} 
              className="w-full py-2 px-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.department_id} value={dept.department_id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {roleFilter === 'Student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Year of Study
              </label>
              <select
                onChange={(e) => setYearOfStudy(e.target.value)}
                className="w-full py-2 px-3 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="all">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
              </select>
            </div>
          )}

          {roleFilter === 'Alumni' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Passing Year
              </label>
              <input
                type="number"
                placeholder="e.g., 2020"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                onChange={(e) => setPassingYear(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* --- User Card Results --- */}
      {loading && (
        <div className="text-center">Loading users...</div>
      )}
      {!loading && !error && (
        <>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Showing {users.length} of {totalUsers} users.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(user => (
              <UserCard 
                key={user.user_id} 
                user={user}
                myId={loggedInUser?.id || 0}
                onConnect={handleConnect}
                onAccept={handleAccept} 
                onReject={handleReject} // <-- Pass new handler
                onMessage={handleMessage}
              />
            ))}
          </div>
          {users.length === 0 && (
            <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">No Users Found</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </>
      )}

      <ToastNotification message={message} error={error} clearMessages={clearMessages} />
    </div>
  );
}

// --- Main Page Export ---
export default function PeoplePage() {
  return (
    <AppLayout>
      <PeoplePageContent />
    </AppLayout>
  );
}