/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
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
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith('audio/')) {
        setFile(selectedFile);
        setAudioUrl(URL.createObjectURL(selectedFile));
        setTranscription('');
        setError(null);
      } else {
        setError('Por favor, selecione um arquivo de áudio válido.');
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
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
    try {
      const base64Data = await fileToBase64(file);
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
          {
            text: "Por favor, transcreva este áudio exatamente como ele é falado. Se houver vários falantes, tente identificá-los se possível. Retorne apenas a transcrição.",
          },
        ],
      });

      const text = response.text;
      if (text) {
        setTranscription(text);
      } else {
        throw new Error('Não foi possível gerar a transcrição.');
      }
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao transcrever o áudio. Verifique se o arquivo não é muito grande ou tente novamente.');
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
          <div className="text-xs font-medium text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
            Powered JS Software e Tecnologia
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Upload & Controls */}
          <div className="lg:col-span-5 space-y-8">
            <section>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Importar Áudio</h2>
              
              {!file ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 bg-white hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-900">Clique para fazer upload</p>
                    <p className="text-sm text-gray-500 mt-1">MP3, WAV, M4A ou OGG</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="audio/*"
                    className="hidden"
                  />
                </motion.div>
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
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
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
                        className="hidden"
                      />
                      <div className="flex items-center justify-center gap-4">
                        <button 
                          onClick={togglePlay}
                          className="w-12 h-12 bg-white rounded-full shadow-sm border border-gray-200 flex items-center justify-center hover:scale-105 transition-transform"
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                        </button>
                        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-blue-600"
                            animate={{ width: isPlaying ? '100%' : '0%' }}
                            transition={{ duration: audioRef.current?.duration || 0, ease: "linear" }}
                          />
                        </div>
                      </div>
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
                        Transcrevendo...
                      </>
                    ) : (
                      'Iniciar Transcrição'
                    )}
                  </button>
                </motion.div>
              )}
            </section>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* Right Column: Transcription Output */}
          <div className="lg:col-span-7">
            <section className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Resultado da Transcrição</h2>
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

              <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
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
                    ) : isTranscribing ? (
                      <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center gap-4"
                      >
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ height: [10, 30, 10] }}
                              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                              className="w-1.5 bg-blue-500 rounded-full"
                            />
                          ))}
                        </div>
                        <p className="text-sm text-gray-500 font-medium">Analisando ondas sonoras...</p>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="prose prose-blue max-w-none"
                      >
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {transcription}
                        </p>
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
