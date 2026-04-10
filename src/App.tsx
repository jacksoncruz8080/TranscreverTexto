/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  FileAudio, 
  Upload, 
  Loader2, 
  Copy, 
  Check, 
  Play, 
  Pause,
  RotateCcw,
  Volume2,
  AlertCircle,
  Mic,
  Square,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const recordedFile = new File([blob], `gravacao-${new Date().getTime()}.webm`, { type: 'audio/webm' });
        
        setFile(recordedFile);
        setAudioUrl(URL.createObjectURL(recordedFile));
        setTranscription('');
        setError(null);
        setCurrentTime(0);
        setDuration(0);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('audio/')) {
        setFile(selectedFile);
        setAudioUrl(URL.createObjectURL(selectedFile));
        setTranscription('');
        setError(null);
        setProgress(0);
        setCurrentChunk(0);
        setTotalChunks(0);
        setCurrentTime(0);
        setDuration(0);
      } else {
        setError('Por favor, selecione um arquivo de áudio válido.');
      }
    }
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer, startOffset: number, endOffset: number): Blob => {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const length = endOffset - startOffset;
    const wavBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(wavBuffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length * 2, true);

    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = startOffset; i < endOffset; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const transcribeAudio = async () => {
    if (!file) return;

    setIsTranscribing(true);
    setError(null);
    setTranscription('');
    setProgress(0);

    try {
      // Step 1: Decode Audio
      setProgress(1); // Start progress
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        throw new Error('Falha ao decodificar o áudio. O formato pode não ser suportado ou o arquivo está corrompido.');
      }

      // Step 2: Prepare Chunks (5 minutes each)
      const segmentDuration = 300; // 5 minutes in seconds
      const samplesPerSegment = 16000 * segmentDuration;
      const totalSamples = audioBuffer.length;
      const chunksCount = Math.ceil(totalSamples / samplesPerSegment);
      setTotalChunks(chunksCount);

      let fullTranscription = '';

      for (let i = 0; i < chunksCount; i++) {
        setCurrentChunk(i + 1);
        const start = i * samplesPerSegment;
        const end = Math.min(start + samplesPerSegment, totalSamples);
        
        const wavBlob = audioBufferToWav(audioBuffer, start, end);
        const chunkBase64 = await blobToBase64(wavBlob);
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              inlineData: {
                mimeType: "audio/wav",
                data: chunkBase64,
              },
            },
            {
              text: "Transcreva este áudio exatamente como ele é falado. Ignore ruídos de fundo. Retorne APENAS o texto da transcrição, sem introduções ou comentários.",
            },
          ],
        });

        const chunkText = response.text;
        if (chunkText) {
          fullTranscription += (fullTranscription ? ' ' : '') + chunkText.trim();
          setTranscription(fullTranscription);
        }
        
        const currentProgress = Math.round(((i + 1) / chunksCount) * 100);
        setProgress(currentProgress);
      }

      await audioCtx.close();

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Ocorreu um erro inesperado durante a transcrição.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const reset = () => {
    setFile(null);
    setAudioUrl(null);
    setTranscription('');
    setError(null);
    setProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setCurrentTime(0);
    setDuration(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileAudio className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Transcrever Áudio em Texto</h1>
          </div>
          <div className="text-xs font-medium text-gray-500 tracking-widest bg-gray-100 px-3 py-1 rounded-full">
            Powered by JS Software e Tecnologia
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Upload & Controls */}
          <div className="lg:col-span-5 space-y-8">
            <section className="space-y-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Entrada de Áudio</h2>
              
              {!file ? (
                <div className="space-y-4">
                  {/* Upload Area */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => !isRecording && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-white transition-all cursor-pointer group ${isRecording ? 'opacity-50 cursor-not-allowed' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50/30'}`}
                  >
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Upload className="w-7 h-7 text-gray-400 group-hover:text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-gray-900">Importar arquivo</p>
                      <p className="text-xs text-gray-500 mt-1">MP3, WAV, M4A, OGG</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="audio/*"
                      className="hidden"
                      disabled={isRecording}
                    />
                  </motion.div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-200"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#F8F9FA] px-2 text-gray-400 font-bold">ou</span>
                    </div>
                  </div>

                  {/* Recording Area */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`border border-gray-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col items-center gap-4 ${isRecording ? 'ring-2 ring-red-500 border-transparent' : ''}`}
                  >
                    {isRecording ? (
                      <div className="flex flex-col items-center gap-3 w-full">
                        <div className="flex items-center gap-2 text-red-600 font-mono font-bold text-xl">
                          <motion.div 
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="w-3 h-3 bg-red-600 rounded-full"
                          />
                          {formatTime(recordingTime)}
                        </div>
                        <p className="text-xs text-gray-500 font-medium">Gravando áudio do microfone...</p>
                        <button 
                          onClick={stopRecording}
                          className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Square className="w-4 h-4 fill-current" />
                          Parar Gravação
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 w-full">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                          <Mic className="w-7 h-7 text-red-600" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-gray-900">Gravar agora</p>
                          <p className="text-xs text-gray-500 mt-1">Use seu microfone</p>
                        </div>
                        <button 
                          onClick={startRecording}
                          className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors flex items-center justify-center gap-2"
                        >
                          <Circle className="w-4 h-4 fill-red-600 text-red-600" />
                          Iniciar Gravador
                        </button>
                      </div>
                    )}
                  </motion.div>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Volume2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button 
                      onClick={reset}
                      disabled={isTranscribing}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
                      title="Remover arquivo"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>

                  {audioUrl && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                      <audio 
                        ref={audioRef} 
                        src={audioUrl} 
                        onEnded={() => setIsPlaying(false)}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        className="hidden"
                      />
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-center gap-4">
                          <button 
                            onClick={togglePlay}
                            className="w-12 h-12 bg-white rounded-full shadow-sm border border-gray-200 flex items-center justify-center hover:scale-105 transition-transform shrink-0"
                          >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                          </button>
                          <div className="flex-1 flex flex-col gap-1">
                            <input 
                              type="range"
                              min="0"
                              max={duration || 0}
                              value={currentTime}
                              onChange={handleSeek}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                              <span>{formatTime(Math.floor(currentTime))}</span>
                              <span>{formatTime(Math.floor(duration))}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isTranscribing && (
                    <div className="mb-6 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-blue-600 uppercase tracking-wider">
                        <span>Progresso Total</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 text-center font-medium">
                        Processando parte {currentChunk} de {totalChunks}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={transcribeAudio}
                    disabled={isTranscribing}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Iniciar Transcrição Completa'
                    )}
                  </button>
                </motion.div>
              )}
            </section>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Dica para arquivos longos</h3>
              <p className="text-xs text-blue-800 leading-relaxed">
                Arquivos grandes são divididos em partes menores para garantir que nada seja cortado. 
                O texto aparecerá na direita conforme cada parte for concluída.
              </p>
            </div>
          </div>

          {/* Right Column: Transcription Output */}
          <div className="lg:col-span-7">
            <section className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Resultado da Transcrição</h2>
                  {isTranscribing && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      AINDA PROCESSANDO...
                    </span>
                  )}
                </div>
                {transcription && (
                  <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <><Check className="w-3.5 h-3.5" /> Copiado!</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copiar Texto</>
                    )}
                  </button>
                )}
              </div>

              <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                  <AnimatePresence mode="wait">
                    {!transcription && !isTranscribing ? (
                      <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center text-center text-gray-400"
                      >
                        <FileAudio className="w-12 h-12 mb-4 opacity-20" />
                        <p>A transcrição aparecerá aqui após o processamento.</p>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="prose prose-blue max-w-none"
                      >
                        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-sans text-base">
                          {transcription}
                          {isTranscribing && (
                            <span className="inline-flex ml-2">
                              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s] mx-1"></span>
                              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
      `}</style>
    </div>
  );
}
