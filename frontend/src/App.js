import { useState } from 'react';
import axios from 'axios';
import {
  Room,
  createLocalTracks,
  RoomEvent,
} from 'livekit-client';

function App() {
  const [room, setRoom] = useState(null);
  const [localTracks, setLocalTracks] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [averages, setAverages] = useState({});
  const [voiceActive, setVoiceActive] = useState(false);

  const clearMetricsLog = async () => {
    try {
      await axios.get('http://localhost:5000/start-call');
      console.log('Cleared metrics_log.csv');
    } catch (err) {
      console.error('Failed to clear metrics log:', err);
    }
  };

  const fetchMetricsLog = async () => {
    try {
      const res = await axios.get('http://localhost:5000/end-call');
      const data = res.data.metrics;
      


      if (!data || data.length === 0) return;

      const rows = data;
      console.log("Fetched rows:", rows);
      setMetrics(rows);

      const colIndexes = {
        ttft: 3,
        ttfb: 4,
        total_latency: 5,
      };

      const sum = { ttft: 0, ttfb: 0, total_latency: 0 };
      rows.forEach(row => {
        sum.ttft += Number(row[colIndexes.ttft]) || 0;
        sum.ttfb += Number(row[colIndexes.ttfb]) || 0;
        sum.total_latency += Number(row[colIndexes.total_latency]) || 0;
      });

      const count = rows.length;
      setAverages({
        ttft: (sum.ttft / count).toFixed(2),
        ttfb: (sum.ttfb / count).toFixed(2),
        total_latency: (sum.total_latency / count).toFixed(2),
      });
    } catch (err) {
      console.error('Failed to fetch metrics log:', err);
    }
  };

  const connectToRoom = async () => {
    await clearMetricsLog();

    try {
      const res = await axios.get('http://localhost:5000/token');
      const { token, livekit_url } = res.data;

      const newRoom = new Room();

      newRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === 'audio') {
          const audio = track.attach();
          document.body.appendChild(audio);
        }
      });

      await newRoom.connect(livekit_url, token);

      const tracks = await createLocalTracks({ audio: true });
      for (const track of tracks) {
        await newRoom.localParticipant.publishTrack(track);
      }

      setVoiceActive(true);
      setLocalTracks(tracks);
      setRoom(newRoom);
      console.log(`Connected to room: ${newRoom.name}`);
    } catch (err) {
      console.error("Failed to connect to LiveKit:", err.message);
    }
  };

  const disconnectRoom = async () => {
    if (room) {
      localTracks.forEach(track => track.stop());
      room.disconnect();
      setRoom(null);
      setLocalTracks([]);
      setVoiceActive(false);
      console.log('Disconnected from room');

      await fetchMetricsLog();
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🎙️ Talk to <span style={{ color: '#4ADEDE' }}>FinanceBot</span></h1>
      <p style={styles.subText}>Allow microphone access and speak to your AI advisor.</p>

      {voiceActive && (
        <div style={styles.micIndicatorContainer}>
          <div style={styles.micPulse}></div>
          <span style={{ marginLeft: 10, fontSize: '1rem' }}>Listening...</span>
        </div>
      )}

      <div style={styles.buttonGroup}>
        <button
          onClick={connectToRoom}
          disabled={room !== null}
          style={{ ...styles.button, backgroundColor: '#4ADEDE' }}
        >
          🎧 Start Call
        </button>
        <button
          onClick={disconnectRoom}
          disabled={room === null}
          style={{ ...styles.button, backgroundColor: '#EF4444' }}
        >
          📴 End Call
        </button>
      </div>

      {metrics.length > 0 && (
        <div style={styles.metricsContainer}>
          <h2 style={styles.metricsTitle}>📊 Call Metrics</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>DateTime</th>
                <th>Speech ID</th>
                <th>EOU</th>
                <th>TTFT (ms)</th>
                <th>TTFB (ms)</th>
                <th>Total Latency (ms)</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((row, idx) => (
                <tr key={idx}>
                  {row.map((cell, i) => <td key={i}>{cell}</td>)}
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', backgroundColor: '#1a1a1a' }}>
                <td colSpan="3">Average</td>
                <td>{averages.ttft}</td>
                <td>{averages.ttfb}</td>
                <td>{averages.total_latency}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    fontFamily: 'Segoe UI, sans-serif',
    backgroundColor: '#0f0f0f',
    color: '#f4f4f4',
    minHeight: '100vh',
  },
  heading: {
    fontSize: '2.5rem',
    marginBottom: '0.5rem',
  },
  subText: {
    fontSize: '1.1rem',
    color: '#cccccc',
  },
  micIndicatorContainer: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '1rem',
  },
  micPulse: {
    width: '20px',
    height: '20px',
    backgroundColor: '#4ADEDE',
    borderRadius: '50%',
    animation: 'pulse 1.2s infinite',
  },
  buttonGroup: {
    marginTop: '2rem',
    display: 'flex',
    gap: '1rem',
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
  metricsContainer: {
    marginTop: '3rem',
    alignItems  : 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: '1rem',
    borderRadius: '12px',
    backdropFilter: 'blur(6px)',
  },
  metricsTitle: {
    fontSize: '1.5rem',
    marginBottom: '1rem',
    color: '#4ADEDE',
  },
  table: {
    width: '100%',
    alignItems: 'center',
    borderCollapse: 'collapse',
    color: '#ddd',
  },
  '@keyframes pulse': {
    '0%': { transform: 'scale(1)', opacity: 1 },
    '50%': { transform: 'scale(1.5)', opacity: 0.5 },
    '100%': { transform: 'scale(1)', opacity: 1 },
  },
};

export default App;
