import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { message, numbers } = await request.json()

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: "8Haxctm2NSV40PK35GigsI7OjfRXuUq1dEobky6lpvBYTrJFDAtHlR5uozWVhM43eXv7Bax9ZYKQIc1p",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        message: message,
        language: "english",
        route: "q",
        numbers: numbers,
      }),
    })

    const data = await response.json()

    if (data.return) {
      return NextResponse.json({
        success: true,
        message: "SMS sent successfully",
        request_id: data.request_id,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to send SMS",
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("SMS API Error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    )
  }
}
