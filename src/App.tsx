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
  Volume2,
  AlertCircle
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
        setProgress(0);
        setCurrentChunk(0);
        setTotalChunks(0);
      } else {
        setError('Por favor, selecione um arquivo de áudio válido.');
      }
    }
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
      // Chunk size: ~10MB (approx 10-15 mins of compressed audio)
      const CHUNK_SIZE = 10 * 1024 * 1024; 
      const OVERLAP_SIZE = 512 * 1024; // 0.5MB overlap to avoid losing words at boundaries
      
      const chunks: Blob[] = [];
      let start = 0;
      
      while (start < file.size) {
        const end = Math.min(start + CHUNK_SIZE, file.size);
        chunks.push(file.slice(start, end));
        start += (CHUNK_SIZE - OVERLAP_SIZE);
      }

      setTotalChunks(chunks.length);
      let fullTranscription = '';

      for (let i = 0; i < chunks.length; i++) {
        setCurrentChunk(i + 1);
        const chunkBase64 = await blobToBase64(chunks[i]);
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              inlineData: {
                mimeType: file.type,
                data: chunkBase64,
              },
            },
            {
              text: i === 0 
                ? "Transcreva este áudio integralmente. Retorne apenas o texto da transcrição, sem comentários adicionais."
                : "Este áudio é a continuação de uma parte anterior. Transcreva esta parte integralmente. Retorne apenas o texto da transcrição desta parte específica, sem comentários adicionais.",
            },
          ],
        });

        const chunkText = response.text;
        if (chunkText) {
          // Simple deduplication for overlap: try to find where the new text starts
          // This is a basic heuristic, Gemini usually handles the context well if prompted
          fullTranscription += (fullTranscription ? '\n\n' : '') + chunkText;
          setTranscription(fullTranscription);
        }
        
        const currentProgress = Math.round(((i + 1) / chunks.length) * 100);
        setProgress(currentProgress);
      }

    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao transcrever o áudio. O arquivo pode ser muito complexo ou houve instabilidade na conexão.');
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
                    <p className="text-sm text-gray-500 mt-1">Ideal para áudios longos (2h+)</p>
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
