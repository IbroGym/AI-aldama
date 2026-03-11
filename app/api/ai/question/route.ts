import { generateText, tool } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const startTime = Date.now()
  const { question, stopId, stopName } = await req.json()

  if (!question) {
    return Response.json({ error: "Question is required" }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch context data for the AI
  const [
    { data: routes },
    { data: stops },
    { data: etas },
    { data: alerts },
  ] = await Promise.all([
    supabase.from("bus_routes").select("*").eq("is_active", true),
    supabase.from("bus_stops").select("*").eq("is_active", true),
    stopId
      ? supabase
          .from("eta_predictions")
          .select("*, bus:buses(bus_number), route:bus_routes(*)")
          .eq("stop_id", stopId)
          .gte("predicted_arrival", new Date().toISOString())
          .order("predicted_arrival", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    supabase.from("alerts").select("*").eq("is_active", true),
  ])

  // Build context for the AI
  const currentStop = stops?.find((s) => s.id === stopId)
  const upcomingArrivals = etas?.map((eta) => ({
    route: eta.route?.route_number,
    routeName: eta.route?.route_name,
    busNumber: eta.bus?.bus_number,
    arrivalTime: eta.predicted_arrival,
    minutesAway: Math.round(
      (new Date(eta.predicted_arrival).getTime() - Date.now()) / 60000
    ),
  }))

  const systemPrompt = `You are a helpful transit assistant at a bus stop kiosk. You help passengers with information about bus arrivals, routes, and schedules.

Current Context:
- Current Stop: ${stopName || currentStop?.name || "Unknown"}
- Stop Code: ${currentStop?.stop_code || "Unknown"}
- Current Time: ${new Date().toLocaleTimeString()}

Available Routes: ${routes?.map((r) => `${r.route_number} (${r.route_name})`).join(", ") || "None"}

Upcoming Arrivals at this Stop:
${
  upcomingArrivals?.length
    ? upcomingArrivals
        .map(
          (a) =>
            `- Route ${a.route} (${a.routeName}): Bus ${a.busNumber} arriving in ${a.minutesAway} minutes`
        )
        .join("\n")
    : "No upcoming arrivals"
}

Active Alerts:
${
  alerts?.length
    ? alerts.map((a) => `- ${a.title}: ${a.message}`).join("\n")
    : "No active alerts"
}

Instructions:
- Be concise and helpful
- Provide specific arrival times when asked about next buses
- If asked about routes you don't have info for, say so politely
- For complex route planning, suggest checking the main transit app
- Always be friendly and professional`

  // Rule-based fallback function for when AI is unavailable
  const generateFallbackAnswer = (): string => {
    const questionLower = question.toLowerCase()
    
    // Next arrival queries
    if (questionLower.includes("next") || questionLower.includes("when")) {
      if (upcomingArrivals?.length) {
        const next = upcomingArrivals[0]
        return `The next bus is Route ${next.route} (${next.routeName}), arriving in ${next.minutesAway} minutes.`
      }
      return "There are currently no upcoming arrivals at this stop."
    }
    
    // Route information queries
    if (questionLower.includes("route") && routes?.length) {
      const routeMatch = questionLower.match(/route\s*(\d+|[a-z]\d+)/i)
      if (routeMatch) {
        const routeNum = routeMatch[1].toUpperCase()
        const route = routes.find((r) => r.route_number.toUpperCase() === routeNum)
        if (route) {
          return `Route ${route.route_number} is the ${route.route_name}. It is currently ${route.is_active ? "active" : "inactive"}.`
        }
        return `I don't have information about Route ${routeNum}.`
      }
      return `We have the following routes: ${routes.slice(0, 5).map((r) => r.route_number).join(", ")}.`
    }
    
    // Alert queries
    if (questionLower.includes("alert") || questionLower.includes("delay") || questionLower.includes("running")) {
      if (alerts?.length) {
        return `There are ${alerts.length} active alerts: ${alerts.slice(0, 2).map((a) => a.title).join(", ")}.`
      }
      return "There are no active service alerts at this time."
    }
    
    // List all arrivals
    if (questionLower.includes("list") || questionLower.includes("all buses")) {
      if (upcomingArrivals?.length) {
        return `Upcoming arrivals:\n${upcomingArrivals
          .slice(0, 4)
          .map((a) => `• Route ${a.route}: ${a.minutesAway} min`)
          .join("\n")}`
      }
      return "There are no upcoming arrivals at this stop."
    }
    
    // Default response
    return `I'm here to help with bus arrival times and route information. The next bus at ${stopName || "this stop"} is ${
      upcomingArrivals?.length
        ? `Route ${upcomingArrivals[0].route} in ${upcomingArrivals[0].minutesAway} minutes`
        : "not currently scheduled"
    }.`
  }

  try {
    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      prompt: question,
      tools: {
        getNextArrival: tool({
          description: "Get the next bus arrival at the current stop",
          inputSchema: z.object({
            routeNumber: z.string().optional().describe("Specific route number to check"),
          }),
          execute: async ({ routeNumber }) => {
            if (routeNumber) {
              const arrival = upcomingArrivals?.find(
                (a) => a.route?.toLowerCase() === routeNumber.toLowerCase()
              )
              if (arrival) {
                return `Route ${arrival.route} (${arrival.routeName}) - Bus ${arrival.busNumber} arrives in ${arrival.minutesAway} minutes`
              }
              return `No upcoming arrivals for Route ${routeNumber} at this stop`
            }
            if (upcomingArrivals?.length) {
              const next = upcomingArrivals[0]
              return `Next bus: Route ${next.route} (${next.routeName}) - Bus ${next.busNumber} arrives in ${next.minutesAway} minutes`
            }
            return "No upcoming arrivals at this stop"
          },
        }),
        getRouteInfo: tool({
          description: "Get information about a specific route",
          inputSchema: z.object({
            routeNumber: z.string().describe("The route number to get info about"),
          }),
          execute: async ({ routeNumber }) => {
            const route = routes?.find(
              (r) => r.route_number.toLowerCase() === routeNumber.toLowerCase()
            )
            if (route) {
              return `Route ${route.route_number}: ${route.route_name} - Status: ${route.is_active ? "Active" : "Inactive"}`
            }
            return `Route ${routeNumber} not found`
          },
        }),
        getAlerts: tool({
          description: "Get current service alerts",
          inputSchema: z.object({}),
          execute: async () => {
            if (alerts?.length) {
              return alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.title}: ${a.message}`).join("\n")
            }
            return "No active service alerts"
          },
        }),
      },
      maxSteps: 3,
    })

    const responseTime = Date.now() - startTime
    const answer = result.text

    // Determine intent from the question
    let intent = "general"
    const questionLower = question.toLowerCase()
    if (questionLower.includes("when") || questionLower.includes("next") || questionLower.includes("arrive")) {
      intent = "eta_query"
    } else if (questionLower.includes("route") || questionLower.includes("get to") || questionLower.includes("go to")) {
      intent = "route_query"
    } else if (questionLower.includes("schedule") || questionLower.includes("time") || questionLower.includes("last")) {
      intent = "schedule_query"
    } else if (questionLower.includes("running") || questionLower.includes("status") || questionLower.includes("delay")) {
      intent = "service_status"
    }

    // Log the query
    await supabase.from("ai_query_logs").insert({
      stop_id: stopId || null,
      question,
      answer,
      intent,
      confidence: 0.9,
      response_time_ms: responseTime,
      was_successful: true,
    })

    return Response.json({
      answer,
      intent,
      responseTime,
    })
  } catch (error) {
    const responseTime = Date.now() - startTime
    console.log("[v0] AI API error, using fallback:", error)

    // Use rule-based fallback when AI is unavailable
    const fallbackAnswer = generateFallbackAnswer()
    
    // Determine intent from the question
    let intent = "general"
    const questionLower = question.toLowerCase()
    if (questionLower.includes("when") || questionLower.includes("next") || questionLower.includes("arrive")) {
      intent = "eta_query"
    } else if (questionLower.includes("route") || questionLower.includes("get to") || questionLower.includes("go to")) {
      intent = "route_query"
    } else if (questionLower.includes("schedule") || questionLower.includes("time") || questionLower.includes("last")) {
      intent = "schedule_query"
    } else if (questionLower.includes("running") || questionLower.includes("status") || questionLower.includes("delay")) {
      intent = "service_status"
    }

    // Log the fallback query
    if (supabase) {
      await supabase.from("ai_query_logs").insert({
        stop_id: stopId || null,
        question,
        answer: fallbackAnswer,
        intent,
        confidence: 0.7,
        response_time_ms: responseTime,
        was_successful: true,
      })
    }

    return Response.json({
      answer: fallbackAnswer,
      intent,
      responseTime,
      fallback: true,
    })
  }
}
