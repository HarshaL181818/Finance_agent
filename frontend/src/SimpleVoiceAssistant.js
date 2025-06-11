import React, { useEffect, useState } from "react";
import "@livekit/components-styles";
import { 
  useVoiceAssistant, 
  BarVisualizer, 
  useConnectionState
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

export default function SimpleVoiceAssistant() {
  const { state, audioTrack } = useVoiceAssistant();
  const connectionState = useConnectionState();
  
  // Metrics state
  const [metrics, setMetrics] = useState({
    conversationStartTime: null,
    lastUserSpeechStart: null,
    lastUserSpeechEnd: null,
    lastAiResponseStart: null,
    lastAiResponseEnd: null,
    totalConversationTime: 0,
    turnCount: 0,
    avgResponseTime: 0,
    eouDelay: 0, // End of Utterance delay
    ttft: 0, // Time to First Token
    ttfb: 0, // Time to First Byte
    totalLatency: 0
  });

  const [isRecording, setIsRecording] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);

  // Track conversation metrics
  useEffect(() => {
    const now = Date.now();
    
    switch (state) {
      case "listening":
        if (!isRecording) {
          setIsRecording(true);
          setMetrics(prev => ({
            ...prev,
            lastUserSpeechStart: now,
            conversationStartTime: prev.conversationStartTime || now
          }));
        }
        break;
        
      case "thinking":
        if (isRecording) {
          setIsRecording(false);
          setMetrics(prev => {
            const speechEnd = now;
            const eouDelay = speechEnd - (prev.lastUserSpeechStart || speechEnd);
            
            return {
              ...prev,
              lastUserSpeechEnd: speechEnd,
              eouDelay: eouDelay,
              turnCount: prev.turnCount + 1
            };
          });
        }
        break;
        
      case "speaking":
        setMetrics(prev => {
          const responseStart = now;
          const ttft = responseStart - (prev.lastUserSpeechEnd || responseStart);
          const ttfb = ttft; // For voice, TTFB ≈ TTFT
          
          return {
            ...prev,
            lastAiResponseStart: responseStart,
            ttft: ttft,
            ttfb: ttfb
          };
        });
        break;
        
      case "idle":
        if (metrics.lastAiResponseStart && !metrics.lastAiResponseEnd) {
          setMetrics(prev => {
            const responseEnd = now;
            const totalLatency = responseEnd - (prev.lastUserSpeechEnd || responseEnd);
            const responseTime = responseEnd - (prev.lastAiResponseStart || responseEnd);
            
            return {
              ...prev,
              lastAiResponseEnd: responseEnd,
              totalLatency: totalLatency,
              avgResponseTime: prev.turnCount > 0 ? 
                ((prev.avgResponseTime * (prev.turnCount - 1)) + responseTime) / prev.turnCount : 
                responseTime
            };
          });
        }
        break;
    }
  }, [state, isRecording, metrics.lastUserSpeechStart, metrics.lastAiResponseStart, metrics.lastAiResponseEnd, metrics.turnCount, metrics.avgResponseTime]);

  // Calculate total conversation time
  useEffect(() => {
    const interval = setInterval(() => {
      if (metrics.conversationStartTime) {
        setMetrics(prev => ({
          ...prev,
          totalConversationTime: Date.now() - prev.conversationStartTime
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [metrics.conversationStartTime]);

  const formatTime = (ms) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStateColor = (currentState) => {
    switch (currentState) {
      case "listening": return "text-green-600 bg-green-50";
      case "thinking": return "text-yellow-600 bg-yellow-50";
      case "speaking": return "text-blue-600 bg-blue-50";
      case "idle": return "text-gray-600 bg-gray-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getStateIcon = (currentState) => {
    switch (currentState) {
      case "listening": return "🎤";
      case "thinking": return "🤔";
      case "speaking": return "🗣️";
      case "idle": return "💤";
      default: return "⚪";
    }
  };

  const resetMetrics = () => {
    setMetrics({
      conversationStartTime: null,
      lastUserSpeechStart: null,
      lastUserSpeechEnd: null,
      lastAiResponseStart: null,
      lastAiResponseEnd: null,
      totalConversationTime: 0,
      turnCount: 0,
      avgResponseTime: 0,
      eouDelay: 0,
      ttft: 0,
      ttfb: 0,
      totalLatency: 0
    });
    setConversationHistory([]);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Main Voice Interface */}
      <div className="p-8 text-center">
        <div className="mb-6">
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getStateColor(state)}`}>
            <span className="mr-2">{getStateIcon(state)}</span>
            Status: {state.charAt(0).toUpperCase() + state.slice(1)}
          </div>
        </div>

        {/* Voice Visualizer */}
        <div className="h-32 mb-6 flex items-center justify-center bg-gray-50 rounded-lg">
          <BarVisualizer 
            state={state} 
            trackRef={audioTrack} 
            barCount={8}
            className="h-24"
          />
        </div>

        {/* Connection Status */}
        <div className="mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            connectionState === ConnectionState.Connected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {connectionState === ConnectionState.Connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>

        {/* Instructions */}
        <p className="text-gray-600 text-sm">
          Start speaking to interact with the AI assistant. The system will automatically detect when you're done speaking.
        </p>
      </div>

      {/* Real-time Metrics Dashboard */}
      <div className="border-t bg-gray-50 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Live Metrics</h3>
          <button 
            onClick={resetMetrics}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{metrics.turnCount}</div>
            <div className="text-xs text-gray-500">Turn Count</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {formatDuration(metrics.totalConversationTime)}
            </div>
            <div className="text-xs text-gray-500">Total Time</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-purple-600">
              {formatTime(metrics.avgResponseTime)}
            </div>
            <div className="text-xs text-gray-500">Avg Response</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-orange-600">
              {formatTime(metrics.totalLatency)}
            </div>
            <div className="text-xs text-gray-500">Last Latency</div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="font-semibold text-gray-700 mb-2">Response Timing</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">EOU Delay:</span>
                <span className="font-mono">{formatTime(metrics.eouDelay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">TTFT:</span>
                <span className="font-mono">{formatTime(metrics.ttft)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">TTFB:</span>
                <span className="font-mono">{formatTime(metrics.ttfb)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="font-semibold text-gray-700 mb-2">Performance</h4>
            <div className="space-y-1">
              {metrics.turnCount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Turns/Min:</span>
                    <span className="font-mono">
                      {metrics.totalConversationTime > 0 ? 
                        ((metrics.turnCount / (metrics.totalConversationTime / 60000)).toFixed(1)) : 
                        '0.0'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Efficiency:</span>
                    <span className="font-mono">
                      {metrics.totalLatency > 0 && metrics.avgResponseTime > 0 ? 
                        `${((metrics.avgResponseTime / metrics.totalLatency) * 100).toFixed(0)}%` : 
                        'N/A'
                      }
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="font-semibold text-gray-700 mb-2">Session Info</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${
                  state === 'idle' ? 'text-gray-600' :
                  state === 'listening' ? 'text-green-600' :
                  state === 'thinking' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {state.charAt(0).toUpperCase() + state.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Started:</span>
                <span className="font-mono text-xs">
                  {metrics.conversationStartTime ? 
                    new Date(metrics.conversationStartTime).toLocaleTimeString() : 
                    'Not started'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-xs text-blue-800">
            <strong>Metrics Guide:</strong> EOU Delay = End of Utterance processing time, 
            TTFT = Time to First Token, TTFB = Time to First Byte, 
            Total Latency = Complete response time from user speech end to AI response start
          </div>
        </div>
      </div>
    </div>
  );
}