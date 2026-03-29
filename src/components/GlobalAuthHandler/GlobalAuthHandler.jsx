import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { socket, connectSocket } from '../../utils/socket';
import ConfirmationModal from '../ConfirmationModal/ConfirmationModal';

const GlobalAuthHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [confirm, setConfirm] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: null 
  });

  useEffect(() => {
    // 1. Get user data
    const userDataStr = localStorage.getItem('user_data');
    if (!userDataStr) return;

    let userData;
    try {
      userData = JSON.parse(userDataStr);
    } catch {
      return;
    }

    if (!userData || !userData.email) return;

    // CRITICAL: Admins must NEVER be affected by student/teacher ban events.
    // The admin is the one triggering the ban, so skip entirely for admin role.
    if (userData.role === 'admin') return;

    // 2. Connect socket
    connectSocket(userData.email, userData.name, userData.id || userData._id);

    // 3. Define handlers
    const handleStatusUpdate = (data) => {
      console.log('Global Auth Handler received:', data);
      
      if (data.status === 'banned' || data.status === 'deleted' || data.status === 'rejected') {
        // Prevent infinite loop if already on homepage/login and logged out
        // But we need to clear session first.

        setConfirm({
          isOpen: true,
          title: data.status === 'deleted' ? 'Account Deleted' : 'Account Suspended',
          message: data.message || `Your account has been ${data.status}.`,
          onConfirm: () => {
             if (data.status === 'deleted' || data.status === 'rejected') {
                 // Delete/Reject: Clear all data
                 localStorage.removeItem('user_data');
                 localStorage.removeItem('preferredRole');
                 navigate('/signup');
             } else {
                 // Ban: Keep data but mark logged out
                 if (userData) {
                     userData.isLoggedIn = false;
                     localStorage.setItem('user_data', JSON.stringify(userData));
                 }
                 // Redirect to login
                 navigate('/login');
             }
             setConfirm(prev => ({ ...prev, isOpen: false }));
          }
        });
      }
    };

    // 4. Attach listeners based on role (or just listen to both if emails are unique)
    // The events are emitted to the room 'email', so we just need to listen to the specific event names.
    // However, the backend emits 'teacher-status-updated' or 'student-status-updated'.
    
    socket.on('teacher-status-updated', handleStatusUpdate);
    socket.on('student-status-updated', handleStatusUpdate);

    return () => {
      socket.off('teacher-status-updated', handleStatusUpdate);
      socket.off('student-status-updated', handleStatusUpdate);
    };
  }, [navigate, location.pathname]); // Re-run if path changes to ensure we are still connected

  return (
    <ConfirmationModal
      isOpen={confirm.isOpen}
      onClose={() => { /* Force user to click confirm? Or just close? User said "custom popup... with yes and than redirect" */ 
          // If they close without clicking yes, we should probably still logout/redirect or they can keep browsing?
          // "Ban" implies they shouldn't browse. 
          // Let's force the action on close too, or just make it non-closable by not providing onClose logic that just hides it.
          // But ConfirmationModal usually has a cancel button. 
          // For now, let's treat close same as confirm for safety.
          confirm.onConfirm && confirm.onConfirm();
      }}
      onConfirm={confirm.onConfirm}
      title={confirm.title}
      message={confirm.message}
      confirmText="Okay"
      isDanger={true}
    />
  );
};

export default GlobalAuthHandler;
