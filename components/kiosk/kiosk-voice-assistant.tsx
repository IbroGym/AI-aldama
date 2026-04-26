"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Mic, MicOff, Volume2, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/components/i18n-provider"

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
  contextArrivals?: Array<{
    routeNumber: string
    routeName: string
    busNumber: string
    minutesAway: number
  }>
}

interface Message {
  role: "user" | "assistant"
  content: string
}

export function KioskVoiceAssistant({
  stopId,
  stopName,
  contextArrivals = [],
}: KioskVoiceAssistantProps) {
  const { locale, t } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const recognitionActiveRef = useRef(false)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Reset assistant session when kiosk stop changes.
  useEffect(() => {
    setMessages([])
    setInput("")
    setIsLoading(false)
    setIsListening(false)
    recognitionActiveRef.current = false
    recognitionRef.current?.stop()
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
  }, [stopId])

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
          locale,
          contextArrivals,
        }),
      })

      const data = await response.json()
      
      const assistantMessage: Message = { 
        role: "assistant", 
          content: data.answer || t("ai.fallbackUnknownQuestion")
      }
      setMessages((prev) => [...prev, assistantMessage])
      
      speak(assistantMessage.content)
    } catch {
      const errorMessage: Message = {
        role: "assistant",
        content: t("ai.fallbackError"),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, stopId, stopName, speak, locale, contextArrivals, t])

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = getSpeechRecognition()
    if (SpeechRecognitionAPI) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US"

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        recognitionActiveRef.current = false
        setIsListening(false)
      }

      recognition.onerror = () => {
        recognitionActiveRef.current = false
        setIsListening(false)
      }

      recognition.onend = () => {
        recognitionActiveRef.current = false
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      recognitionActiveRef.current = false
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [locale])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert(t("kiosk.speechNotSupported"))
      return
    }

    if (isListening || recognitionActiveRef.current) {
      recognitionRef.current.stop()
      recognitionActiveRef.current = false
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.start()
        recognitionActiveRef.current = true
        setIsListening(true)
      } catch {
        // Guard against repeated start() when recognition is still active.
        recognitionActiveRef.current = false
        setIsListening(false)
      }
    }
  }

  const suggestedQuestions = [
    "When is the next bus?",
    "How do I get to the airport?",
    "Is Route R1 running today?",
    "What time is the last bus?",
  ]

  return (
    <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Mic className="h-5 w-5 text-blue-500" />
          {t("kiosk.voiceAssistant")}
        </h3>
        {isSpeaking && (
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <Volume2 className="h-4 w-4 animate-pulse" />
            {t("kiosk.speaking")}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="mb-4 flex h-48 flex-col gap-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-400">
            <Mic className="mb-2 h-8 w-8 text-slate-300" />
            <p>{t("kiosk.askPlaceholder")}</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-auto bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              {msg.content}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("kiosk.thinking")}
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
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800"
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
            className={`shrink-0 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 ${
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
          placeholder={t("kiosk.typeOrSpeak")}
          className="min-h-10 resize-none border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
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
