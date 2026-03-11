"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Mic, MicOff, Volume2, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  readonly isFinal: boolean
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

interface KioskVoiceAssistantProps {
  stopId?: string
  stopName?: string
}

interface Message {
  role: "user" | "assistant"
  content: string
}

export function KioskVoiceAssistant({ stopId, stopName }: KioskVoiceAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const speak = useCallback((text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  const handleSubmit = useCallback(async (text?: string) => {
    const question = text || input
    if (!question.trim() || isLoading) return

    const userMessage: Message = { role: "user", content: question }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/ai/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          stopId,
          stopName,
        }),
      })

      const data = await response.json()
      
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.answer || "I'm sorry, I couldn't understand that question."
      }
      setMessages((prev) => [...prev, assistantMessage])
      
      speak(assistantMessage.content)
    } catch {
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, there was an error processing your question. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, stopId, stopName, speak])

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = getSpeechRecognition()
    if (SpeechRecognitionAPI) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = "en-US"

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser")
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const suggestedQuestions = [
    "When is the next bus?",
    "How do I get to the airport?",
    "Is Route R1 running today?",
    "What time is the last bus?",
  ]

  return (
    <div className="flex flex-col rounded-2xl bg-[#0d1424] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Mic className="h-5 w-5 text-blue-400" />
          Voice Assistant
        </h3>
        {isSpeaking && (
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <Volume2 className="h-4 w-4 animate-pulse" />
            Speaking...
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="mb-4 flex h-48 flex-col gap-3 overflow-y-auto rounded-xl bg-black/30 p-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-white/50">
            <Mic className="mb-2 h-8 w-8 opacity-50" />
            <p>Ask me about bus arrivals, routes, or schedules</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-auto bg-blue-600 text-white"
                  : "bg-white/10 text-white"
              }`}
            >
              {msg.content}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length === 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(q)}
              className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        {speechSupported && (
          <Button
            variant="outline"
            size="icon"
            onClick={toggleListening}
            className={`shrink-0 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white ${
              isListening ? "animate-pulse bg-red-600/20 ring-2 ring-red-500" : ""
            }`}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="Type or speak your question..."
          className="min-h-10 resize-none border-white/20 bg-white/5 text-white placeholder:text-white/40"
          rows={1}
        />
        <Button
          onClick={() => handleSubmit()}
          disabled={!input.trim() || isLoading}
          className="shrink-0 bg-blue-600 text-white hover:bg-blue-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
