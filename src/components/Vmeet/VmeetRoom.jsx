import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { connectSocket, pusher } from '../../utils/socket';
import ConfirmationModal from '../ConfirmationModal/ConfirmationModal';
import './VmeetRoom.css';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const KingIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="king-svg"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"></path><path d="M12 21h-7l1.5-5h11l1.5 5h-7z"></path></svg>
);

const EnhancedLeaveIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 12H9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const SpeakerWavy = () => (
    <div className="speaker-wavy">
        <span></span><span></span><span></span>
    </div>
);

const VmeetRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    
    const [user, setUser] = useState(() => {
        const userDataStr = localStorage.getItem('user_data');
        if (userDataStr) {
            try {
                const parsed = JSON.parse(userDataStr);
                return { 
                    name: parsed.name || parsed.username || 'User', 
                    email: parsed.email 
                };
            } catch (e) {
                console.error("Error parsing user data", e);
            }
        }
        return { name: 'Guest', email: `guest_${Math.floor(Math.random() * 1000)}@nexted.ai` };
    });

    const [isPreJoin, setIsPreJoin] = useState(true);
    const [meetingTitle, setMeetingTitle] = useState('Meeting Room');
    const [tempMic, setTempMic] = useState(true);
    const [tempCam, setTempCam] = useState(true);
    const [roomExists, setRoomExists] = useState(null);
    const [camStreamAcquired, setCamStreamAcquired] = useState(false);

    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [activeSidebar, setActiveSidebar] = useState('participants'); 
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [unreadChat, setUnreadChat] = useState(false);
    const [participants, setParticipants] = useState([]); 
    const [isHost, setIsHost] = useState(false);

    const localStreamRef = useRef(null);
    const localVideoRef = useRef(null);
    const preJoinVideoRef = useRef(null);
    const peerConnections = useRef({}); // { pusherId: RTCPeerConnection }
    const streamsMap = useRef({}); // { pusherId: MediaStream }
    const channelRef = useRef(null);
    const [activeSpeakerId, setActiveSpeakerId] = useState(null); 
    const [hasRaisedHand, setHasRaisedHand] = useState(false);
    const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);

    const isSidebarOpenRef = useRef(isSidebarOpen);
    const activeSidebarRef = useRef(activeSidebar);

    useEffect(() => { isSidebarOpenRef.current = isSidebarOpen; }, [isSidebarOpen]);
    useEffect(() => { activeSidebarRef.current = activeSidebar; }, [activeSidebar]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 1024) setIsSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const addSystemMessage = useCallback((text, type = 'info') => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'system',
            text,
            color: type === 'join' ? '#22c55e' : type === 'leave' ? '#ef4444' : '#64748b'
        }]);
    }, []);

    const createPeerConnection = useCallback((targetPusherId, isInitiator) => {
        if (peerConnections.current[targetPusherId]) return peerConnections.current[targetPusherId];

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[targetPusherId] = pc;

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        pc.onicecandidate = (event) => {
            if (event.candidate && channelRef.current) {
                channelRef.current.trigger('client-vmeet-signal', { 
                    to: targetPusherId, 
                    from: pusher.connection.socket_id, 
                    signal: { candidate: event.candidate } 
                });
            }
        };

        pc.ontrack = (event) => {
            if (!streamsMap.current[targetPusherId]) {
                streamsMap.current[targetPusherId] = new MediaStream();
            }
            const stream = streamsMap.current[targetPusherId];
            if (!stream.getTracks().find(t => t.id === event.track.id)) {
                stream.addTrack(event.track);
            }
            setParticipants(prev => prev.map(p => 
                p.id === targetPusherId ? { ...p, stream: stream } : p
            ));
        };

        if (isInitiator) {
            pc.onnegotiationneeded = async () => {
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    if (channelRef.current) {
                        channelRef.current.trigger('client-vmeet-signal', { 
                            to: targetPusherId, 
                            from: pusher.connection.socket_id, 
                            signal: { offer } 
                        });
                    }
                } catch (err) {
                    console.error("Negotiation Error:", err);
                }
            };
        }

        return pc;
    }, []);

    const handleSignal = useCallback(async (from, signal) => {
        let pc = peerConnections.current[from];
        if (!pc) pc = createPeerConnection(from, false);

        try {
            if (signal.offer) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                if (channelRef.current) {
                    channelRef.current.trigger('client-vmeet-signal', { 
                        to: from, 
                        from: pusher.connection.socket_id, 
                        signal: { answer } 
                    });
                }
            } else if (signal.answer) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
            } else if (signal.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
        } catch (err) {
            console.error("Signal Handling Error:", err);
        }
    }, [createPeerConnection]);

    const initMedia = useCallback(async () => {
        if (localStreamRef.current) return localStreamRef.current;
        try {
            const constraints = { video: { width: 640, height: 480 }, audio: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;
            setCamStreamAcquired(true);
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            return stream;
        } catch (err) {
            console.error("Media Access Error:", err);
            setIsCamOn(false); setIsMicOn(false);
        }
    }, []);

    useEffect(() => {
        const roomCheckTimeout = setTimeout(() => {
            setRoomExists(prev => prev === null ? false : prev);
        }, 3000);

        const fetchRoomInfo = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/vmeet/info/${roomId}`);
                clearTimeout(roomCheckTimeout);
                setRoomExists(res.data.exists);
                if (res.data.exists && res.data.title) setMeetingTitle(res.data.title);
            } catch (err) { 
                console.error("Room Info Error:", err); 
                setRoomExists(false); 
            }
        };
        fetchRoomInfo();

        if (!isPreJoin) {
            connectSocket(user.email, user.name);
            const channel = pusher.subscribe(`presence-vmeet-${roomId}`);
            channelRef.current = channel;

            channel.bind('pusher:subscription_succeeded', (members) => {
                const list = [];
                members.each(m => {
                    if (m.id !== pusher.connection.socket_id) {
                        list.push({ id: m.id, userName: m.info.name, stream: null, isMicOn: true, isCamOn: true });
                    }
                });
                setParticipants(list);
                list.forEach(p => createPeerConnection(p.id, true));
                addSystemMessage('Joined meeting', 'info');
                setIsHost(members.me.info.isHost || false);
            });

            channel.bind('pusher:member_added', (m) => {
                addSystemMessage(`${m.info.name} joined`, 'join');
                setParticipants(prev => [...prev.filter(p => p.id !== m.id), { id: m.id, userName: m.info.name, stream: null, isMicOn: true, isCamOn: true }]);
                createPeerConnection(m.id, false);
            });

            channel.bind('pusher:member_removed', (m) => {
                addSystemMessage(`${m.info.name} left`, 'leave');
                setParticipants(prev => prev.filter(p => p.id !== m.id));
                if (peerConnections.current[m.id]) {
                    peerConnections.current[m.id].close();
                    delete peerConnections.current[m.id];
                }
                delete streamsMap.current[m.id];
            });

            channel.bind('client-vmeet-signal', ({ signal, from, to }) => {
                if (to === pusher.connection.socket_id) handleSignal(from, signal);
            });

            channel.bind('client-vmeet-message', (msg) => {
                setMessages(prev => [...prev, msg]);
                if (activeSidebarRef.current !== 'chat' || !isSidebarOpenRef.current) setUnreadChat(true);
            });

            channel.bind('client-vmeet-status-changed', ({ id, isMicOn, isCamOn }) => {
                setParticipants(prev => prev.map(p => p.id === id ? { ...p, isMicOn, isCamOn } : p));
            });

            channel.bind('client-vmeet-hand-raised', ({ id, isRaised }) => {
                setParticipants(prev => prev.map(p => p.id === id ? { ...p, hasRaisedHand: isRaised } : p));
            });
        }

        return () => {
            clearTimeout(roomCheckTimeout);
            if (channelRef.current) {
                channelRef.current.unbind_all();
                pusher.unsubscribe(`presence-vmeet-${roomId}`);
            }
        };
    }, [roomId, isPreJoin, createPeerConnection, handleSignal, user.email, user.name, addSystemMessage]);

    useEffect(() => {
        if (isPreJoin && preJoinVideoRef.current && localStreamRef.current) {
            preJoinVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [isPreJoin, camStreamAcquired]);

    useEffect(() => { 
        if (!localStreamRef.current) {
            initMedia(); 
        }
    }, [initMedia]);

    useEffect(() => {
        const pcs = peerConnections.current;
        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            Object.values(pcs).forEach(pc => pc.close());
        };
    }, []);

    const confirmLeave = () => { navigate('/vmeet'); };

    const sendMessage = () => {
        if (newMessage.trim() && channelRef.current) {
            const msg = { 
                id: Date.now(), 
                user: user.name, 
                text: newMessage, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            };
            channelRef.current.trigger('client-vmeet-message', msg);
            setMessages(prev => [...prev, msg]);
            setNewMessage('');
        }
    };

    const toggleMic = () => {
        const next = !isMicOn; setIsMicOn(next);
        if (localStreamRef.current?.getAudioTracks()[0]) localStreamRef.current.getAudioTracks()[0].enabled = next;
        channelRef.current?.trigger('client-vmeet-status-changed', { id: pusher.connection.socket_id, isMicOn: next, isCamOn });
    };

    const toggleCam = () => {
        const next = !isCamOn; setIsCamOn(next);
        if (localStreamRef.current?.getVideoTracks()[0]) localStreamRef.current.getVideoTracks()[0].enabled = next;
        channelRef.current?.trigger('client-vmeet-status-changed', { id: pusher.connection.socket_id, isMicOn, isCamOn: next });
    };

    const toggleRaiseHand = () => {
        const next = !hasRaisedHand; setHasRaisedHand(next);
        channelRef.current?.trigger('client-vmeet-hand-raised', { id: pusher.connection.socket_id, isRaised: next });
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
    };

    if (isPreJoin) {
        return (
            <div className="vmeet-prejoin-root">
                <div className="prejoin-container">
                    <div className="prejoin-preview-section">
                        <div className="preview-video-box">
                            {tempCam ? <video ref={preJoinVideoRef} autoPlay muted playsInline className="preview-video" /> : 
                            <div className="preview-off-overlay"><div className="avatar-preview"><img src={`https://ui-avatars.com/api/?name=${user.name}&background=1089d3&size=128`} alt="Avatar" /></div><p>Camera is off</p></div>}
                            <div className="preview-controls">
                                <button className={`control-btn-pre ${!tempMic ? 'off' : ''}`} onClick={() => setTempMic(!tempMic)}>
                                    {tempMic ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="3" x2="21" y2="21"></line><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>}
                                </button>
                                <button className={`control-btn-pre ${!tempCam ? 'off' : ''}`} onClick={() => setTempCam(!tempCam)}>
                                    {tempCam ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="prejoin-form-section">
                        <div className="form-card-vmeet">
                            <h2>Ready to join?</h2>
                            <p className="subtitle">Check your audio and video before you enter.</p>
                            <div className="vmeet-form-inputs">
                                <div className="input-group-vmeet">
                                    <label>Your Name</label>
                                    <input type="text" value={user.name} onChange={e => setUser({...user, name: e.target.value})} />
                                </div>
                            </div>
                            <button className="start-meeting-btn" disabled={roomExists === null} onClick={() => {
                                setIsMicOn(tempMic); setIsCamOn(tempCam);
                                if (localStreamRef.current) {
                                    if (localStreamRef.current.getAudioTracks()[0]) localStreamRef.current.getAudioTracks()[0].enabled = tempMic;
                                    if (localStreamRef.current.getVideoTracks()[0]) localStreamRef.current.getVideoTracks()[0].enabled = tempCam;
                                }
                                setIsPreJoin(false);
                            }}>
                                {roomExists ? 'Join Meeting' : 'Start Meeting'}
                            </button>
                            {roomExists && <p className="room-info-text">Joining: <strong>{meetingTitle}</strong></p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const galleryParticipants = participants.filter(p => !activeSpeakerId || p.id !== activeSpeakerId);
    const showSelfInGallery = (activeSpeakerId !== null);
    const speakerData = activeSpeakerId ? participants.find(p => p.id === activeSpeakerId) : null;

    return (
        <div className="vmeet-room-inner">
            <header className="room-header">
                <div className="header-left"><img src="/Logo.jpg" alt="Logo" className="room-logo" /></div>
                <div className="header-center">
                    <div className="meeting-title-pill">
                        <button className="back-btn" onClick={() => setIsConfirmingLeave(true)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                        <div className="title-info"><h2>{meetingTitle}</h2><span>NextEd Room: {roomId}</span></div>
                        <div className="header-controls">
                            <button className={`control-btn-small ${!isMicOn ? 'off' : ''}`} onClick={toggleMic}>
                                {isMicOn ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="3" y1="3" x2="21" y2="21"></line></svg>}
                            </button>
                            <button className={`control-btn-small ${!isCamOn ? 'off' : ''}`} onClick={toggleCam}>
                                {isCamOn ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                            </button>
                            <button className="control-btn-small end-call" onClick={() => setIsConfirmingLeave(true)}><EnhancedLeaveIcon /></button>
                            <button className="control-btn-small raise-hand" onClick={toggleRaiseHand} style={{ color: hasRaisedHand ? '#FBBF24' : 'inherit' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill={hasRaisedHand ? '#FBBF24' : 'none'} stroke="currentColor" strokeWidth="2.5"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v10"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="header-right">
                    <button className="copy-link-btn" onClick={copyRoomId}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>Copy code</button>
                    <div className="user-avatar-small"><img src={`https://ui-avatars.com/api/?name=${user.name}&background=1089d3&color=fff`} alt="User" /></div>
                </div>
            </header>
            <main className="room-main">
                <div className="main-content-layout">
                    <div className="active-speaker-container">
                        <div className="video-placeholder">
                            {!speakerData ? (
                                isCamOn ? <video ref={el => { if (el && localStreamRef.current) el.srcObject = localStreamRef.current; localVideoRef.current = el; }} autoPlay muted playsInline className="main-video-feed" /> :
                                <div className="camera-off-overlay"><div className="avatar-large"><img src={`https://ui-avatars.com/api/?name=${user.name}&background=1089d3&size=128`} alt="User" /></div><p>Camera is off</p></div>
                            ) : (
                                speakerData.stream && speakerData.isCamOn !== false ? 
                                <video autoPlay playsInline className="main-video-feed" ref={el => { if (el && speakerData.stream) el.srcObject = speakerData.stream; }} /> :
                                <div className="camera-off-overlay"><div className="avatar-large"><img src={`https://ui-avatars.com/api/?name=${speakerData.userName}&background=random&size=128`} alt={speakerData.userName} /></div><p>{speakerData.userName}'s camera is off</p></div>
                            )}
                            <div className="speaker-tag">
                                {((!speakerData && isHost) || (speakerData && speakerData.isHost)) && <KingIcon />}
                                <span className="speaker-name-text">{!speakerData ? `You (${user.name})` : speakerData.userName}</span>
                                {(!speakerData ? isMicOn : speakerData.isMicOn) && <SpeakerWavy />}
                                {(!speakerData ? hasRaisedHand : speakerData.hasRaisedHand) && <span style={{ marginLeft: '8px' }}>✋</span>}
                            </div>
                        </div>
                    </div>
                    <div className="vertical-gallery">
                        {showSelfInGallery && (
                            <div className={`gallery-card-vertical ${!activeSpeakerId ? 'active-pin' : ''}`} onClick={() => setActiveSpeakerId(null)}>
                                {isCamOn ? <video autoPlay muted playsInline className="gallery-video-feed" ref={el => { if (el && localStreamRef.current) el.srcObject = localStreamRef.current; }} /> :
                                <div className="gallery-placeholder"><div className="avatar-small"><img src={`https://ui-avatars.com/api/?name=${user.name}&background=1089d3&size=48`} alt="User" /></div></div>}
                                <div className="mini-name-tag">{isHost && <KingIcon />}{user.name.split(' ')[0]}</div>
                            </div>
                        )}
                        {galleryParticipants.map(p => (
                            <div key={p.id} className={`gallery-card-vertical ${activeSpeakerId === p.id ? 'active-pin' : ''}`} onClick={() => setActiveSpeakerId(p.id)}>
                                {p.stream && p.isCamOn ? <video autoPlay playsInline className="gallery-video-feed" ref={el => { if (el && p.stream) el.srcObject = p.stream; }} /> :
                                <div className="gallery-placeholder"><div className="avatar-small"><img src={`https://ui-avatars.com/api/?name=${p.userName}&background=random&size=48`} alt={p.userName} /></div></div>}
                                <div className="mini-name-tag">{p.isHost && <KingIcon />}{p.userName.split(' ')[0]}</div>
                            </div>
                        ))}
                    </div>
                </div>
                {isSidebarOpen && (
                    <aside className="room-sidebar">
                        <div className="vmeet-sidebar-tabs">
                            <button className={`vmeet-tab-btn ${activeSidebar === 'participants' ? 'active' : ''}`} onClick={() => setActiveSidebar('participants')}>Participants <span className="count">{participants.length + 1}</span></button>
                            <button className={`vmeet-tab-btn ${activeSidebar === 'chat' ? 'active' : ''}`} onClick={() => { setActiveSidebar('chat'); setUnreadChat(false); }}>Chat {unreadChat && <span className="unread-dot-small"></span>}</button>
                        </div>
                        <div className="vmeet-sidebar-content">
                            {activeSidebar === 'participants' ? (
                                <div className="participants-list">
                                    <h4 className="sidebar-section-title">In call</h4>
                                    <div className="vmeet-participant-row">
                                        <div className="participant-avatar-wrapper"><img src={`https://ui-avatars.com/api/?name=${user.name}&background=1089d3&color=fff`} alt="User" />{isHost && <div className="avatar-badge-crown"><KingIcon /></div>}</div>
                                        <div className="user-info"><span className="name">{user.name} (You)</span><span className="role">{isHost ? 'Host' : 'Participant'}</span></div>
                                        <div className="sidebar-status-icons">{hasRaisedHand && <span className="sidebar-indicator-pill yellow">✋</span>}{isMicOn ? <SpeakerWavy /> : <span className="sidebar-indicator-pill red">Mic Off</span>}</div>
                                    </div>
                                    {participants.map(p => (
                                        <div key={p.id} className="vmeet-participant-row">
                                            <div className="participant-avatar-wrapper"><img src={`https://ui-avatars.com/api/?name=${p.userName}&background=random`} alt={p.userName} /></div>
                                            <div className="user-info"><span className="name">{p.userName}</span><span className="role">Participant</span></div>
                                            <div className="sidebar-status-icons">{p.hasRaisedHand && <span className="sidebar-indicator-pill yellow">✋</span>}{p.isMicOn ? <SpeakerWavy /> : <span className="sidebar-indicator-pill red">Mic Off</span>}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="chat-container-vmeet">
                                    <div className="messages-list">{messages.map(m => <div key={m.id} className={`chat-message ${m.type === 'system' ? 'system' : ''}`}><span className="user">{m.user}:</span><span className="text">{m.text}</span></div>)}</div>
                                    <div className="chat-input-area"><input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="Send a message" /><button onClick={sendMessage}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button></div>
                                </div>
                            )}
                        </div>
                    </aside>
                )}
            </main>
            <ConfirmationModal isOpen={isConfirmingLeave} onConfirm={confirmLeave} onClose={() => setIsConfirmingLeave(false)} title="Leave Meeting" message="Are you sure you want to leave the meeting?" isDanger={true} />
        </div>
    );
};

export default VmeetRoom;
