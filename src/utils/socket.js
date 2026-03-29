import Pusher from 'pusher-js';

// Pusher Configuration
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || 'your-pusher-key';
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'mt1';

// We keep a reference to the auth params to update them dynamically
const authParams = {
  userId: '',
  userName: ''
};

export const pusher = new Pusher(PUSHER_KEY, {
  cluster: PUSHER_CLUSTER,
  forceTLS: true,
  authEndpoint: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/auth/pusher/auth`,
  auth: {
    params: authParams
  }
});

const subscribedChannels = new Map();
let currentEmail = null;

// Event to Channel mapping
const EVENT_CHANNELS = {
  'new-exam': 'exams'
};

const getChannelName = (event, email) => {
  return EVENT_CHANNELS[event] || email;
};

export const connectSocket = (email, name = 'User', id = null) => {
  if (!email) return;
  currentEmail = email;

  // Update Pusher auth params for future authorizations (like presence channels)
  authParams.userId = id || email;
  authParams.userName = name;
  
  // Ensure we are subscribed to the personal channel
  if (!subscribedChannels.has(email)) {
    console.log(`Pusher subscribing to personal channel: ${email}`);
    subscribedChannels.set(email, pusher.subscribe(email));
  }
  
  // Also subscribe to static channels if not already
  if (!subscribedChannels.has('exams')) {
    subscribedChannels.set('exams', pusher.subscribe('exams'));
  }
};

export const disconnectSocket = () => {
  subscribedChannels.forEach((channel, name) => {
    pusher.unsubscribe(name);
  });
  subscribedChannels.clear();
  currentEmail = null;
  console.log('Pusher disconnected/unsubscribed from all channels');
};

// Mock Socket.io-like object for minimal component changes
export const socket = {
  on: (event, callback) => {
    const channelName = getChannelName(event, currentEmail);
    if (!channelName) {
      console.warn(`[Pusher] No channel available for event "${event}". Ensure connectSocket is called with email.`);
      return;
    }
    
    let channel = subscribedChannels.get(channelName);
    if (!channel) {
      channel = pusher.subscribe(channelName);
      subscribedChannels.set(channelName, channel);
    }
    
    console.log(`[Pusher] Binding event "${event}" on channel "${channelName}"`);
    channel.bind(event, callback);
  },
  
  off: (event, callback) => {
    const channelName = getChannelName(event, currentEmail);
    const channel = subscribedChannels.get(channelName);
    if (channel) {
      console.log(`[Pusher] Unbinding event "${event}" from channel "${channelName}"`);
      channel.unbind(event, callback);
    }
  },

  // Pusher doesn't support client-side emit to other clients directly via this instance
  emit: (event) => {
    console.warn(`[Pusher] Client-side emit is not supported for event: ${event}. Use API calls instead.`);
  },

  connected: true // Always true for this mock
};

export default socket;
