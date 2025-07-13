"use client"

import { useState, useEffect } from "react"
import { initializeApp } from "firebase/app"
import { getDatabase, ref, onValue, set } from "firebase/database"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Moon, Sun, Thermometer, Droplets, Wind, AlertTriangle, Settings } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { FileText, FileSpreadsheet } from "lucide-react"

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_W7NHWFq25RxaxoE1WHp_XG7u4g5oa1A",
  databaseURL: "https://iotcool-5469e-default-rtdb.firebaseio.com",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const database = getDatabase(app)

interface SensorData {
  temp: number
  humidity: number
  gas: number
  timestamp: string
}

interface Thresholds {
  temp_min: number
  temp_max: number
  humidity_max: number
  gas_max: number
}

interface AlertData {
  type: string
  value: number
  timestamp: string
}

export default function IoTDashboard() {
  const [darkMode, setDarkMode] = useState(false)
  const [latestData, setLatestData] = useState<SensorData | null>(null)
  const [thresholds, setThresholds] = useState<Thresholds>({
    temp_min: 2,
    temp_max: 8,
    humidity_max: 75,
    gas_max: 400,
  })
  const [lastAlert, setLastAlert] = useState<AlertData | null>(null)
  const [alertHistory, setAlertHistory] = useState<AlertData[]>([])
  const [historicalData, setHistoricalData] = useState<any[]>([])
  const [timeRange, setTimeRange] = useState("24h")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [previousAlert, setPreviousAlert] = useState<AlertData | null>(null)

  useEffect(() => {
    // Listen to latest sensor data
    const latestRef = ref(database, "cold-chain/latest")
    const unsubscribeLatest = onValue(latestRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setLatestData(data)
      }
      setLoading(false)
    })

    // Listen to thresholds
    const thresholdsRef = ref(database, "cold-chain/thresholds")
    const unsubscribeThresholds = onValue(thresholdsRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setThresholds(data)
      }
    })

    // Listen to last alert with toast notifications
    const lastAlertRef = ref(database, "cold-chain/alerts/last")
    const unsubscribeLastAlert = onValue(lastAlertRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        // Check if this is a new alert
        if (previousAlert && (data.timestamp !== previousAlert.timestamp || data.type !== previousAlert.type)) {
          // Show toast for new alert
          toast({
            title: "🚨 New Alert!",
            description: `${data.type}: ${data.value}`,
            variant: "destructive",
            duration: 2000,
          })

          // Send SMS notification
          sendSMSAlert(data)
        }
        setLastAlert(data)
        setPreviousAlert(data)
      }
    })

    // Listen to alert history
    const alertHistoryRef = ref(database, "cold-chain/alerts/history")
    const unsubscribeAlertHistory = onValue(alertHistoryRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const alerts = Object.entries(data)
          .map(([timestamp, alert]: [string, any]) => ({
            ...alert,
            timestamp,
          }))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setAlertHistory(alerts)
      }
    })

    // Listen to historical data
    const historyRef = ref(database, "cold-chain/history")
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const history = Object.entries(data)
          .map(([timestamp, values]: [string, any]) => ({
            timestamp,
            ...values,
            time: new Date(timestamp).toLocaleTimeString(),
          }))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        setHistoricalData(history)
      }
    })

    return () => {
      unsubscribeLatest()
      unsubscribeThresholds()
      unsubscribeLastAlert()
      unsubscribeAlertHistory()
      unsubscribeHistory()
    }
  }, [])

  const updateThresholds = async () => {
    try {
      await set(ref(database, "cold-chain/thresholds"), thresholds)
      alert("Thresholds updated successfully!")
    } catch (error) {
      console.error("Error updating thresholds:", error)
      alert("Failed to update thresholds")
    }
  }

  const getStatusColor = (value: number, min?: number, max?: number) => {
    if (min !== undefined && value < min) return "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
    if (max !== undefined && value > max) return "text-red-600 bg-red-50 dark:bg-red-900/20"
    return "text-green-600 bg-green-50 dark:bg-green-900/20"
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const filteredHistoricalData = historicalData.filter((item) => {
    const itemTime = new Date(item.timestamp).getTime()
    const now = Date.now()
    const hours = timeRange === "1h" ? 1 : timeRange === "6h" ? 6 : 24
    return itemTime > now - hours * 60 * 60 * 1000
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const sendSMSAlert = async (alertData: AlertData) => {
    try {
      const response = await fetch("/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `ALERT: ${alertData.type} detected! Value: ${alertData.value}. Time: ${new Date(alertData.timestamp).toLocaleString()}`,
          numbers: "7205788849",
        }),
      })

      if (response.ok) {
        console.log("SMS alert sent successfully")
      }
    } catch (error) {
      console.error("Failed to send SMS alert:", error)
    }
  }

  const exportToCSV = () => {
    const csvContent = [
      ["Timestamp", "Temperature", "Humidity", "Gas"],
      ...historicalData.map((item) => [item.timestamp, item.temp, item.humidity, item.gas]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cold-chain-data-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportToPDF = () => {
    // Simple PDF export using browser print
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cold Chain Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1 { color: #333; }
            </style>
          </head>
          <body>
            <h1>Cold Chain IoT Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <h2>Current Status</h2>
            <p>Temperature: ${latestData?.temp}°C</p>
            <p>Humidity: ${latestData?.humidity}%</p>
            <p>Gas: ${latestData?.gas} ppm</p>
            <h2>Historical Data</h2>
            <table>
              <tr><th>Timestamp</th><th>Temperature</th><th>Humidity</th><th>Gas</th></tr>
              ${historicalData
                .map(
                  (item) =>
                    `<tr><td>${formatTimestamp(item.timestamp)}</td><td>${item.temp}°C</td><td>${item.humidity}%</td><td>${item.gas} ppm</td></tr>`,
                )
                .join("")}
          </table>
        </body>
      </html>
    `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <Thermometer className="h-8 w-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cold Chain IoT Monitor</h1>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} className="rounded-full">
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">📊 Overview</TabsTrigger>
              <TabsTrigger value="alerts">🚨 Alerts</TabsTrigger>
              <TabsTrigger value="charts">📈 Charts</TabsTrigger>
              <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
            </TabsList>

            {/* Dashboard Overview */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Temperature Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Temperature</CardTitle>
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{latestData?.temp}°C</div>
                    <Badge
                      className={`mt-2 ${getStatusColor(latestData?.temp || 0, thresholds.temp_min, thresholds.temp_max)}`}
                    >
                      {latestData?.temp && latestData.temp < thresholds.temp_min
                        ? "Too Cold"
                        : latestData?.temp && latestData.temp > thresholds.temp_max
                          ? "Too Hot"
                          : "Normal"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      Range: {thresholds.temp_min}°C - {thresholds.temp_max}°C
                    </p>
                  </CardContent>
                </Card>

                {/* Humidity Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Humidity</CardTitle>
                    <Droplets className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{latestData?.humidity}%</div>
                    <Badge
                      className={`mt-2 ${getStatusColor(latestData?.humidity || 0, undefined, thresholds.humidity_max)}`}
                    >
                      {latestData?.humidity && latestData.humidity > thresholds.humidity_max ? "Too High" : "Normal"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">Max: {thresholds.humidity_max}%</p>
                  </CardContent>
                </Card>

                {/* Gas Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gas Level</CardTitle>
                    <Wind className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{latestData?.gas} ppm</div>
                    <Badge className={`mt-2 ${getStatusColor(latestData?.gas || 0, undefined, thresholds.gas_max)}`}>
                      {latestData?.gas && latestData.gas > thresholds.gas_max ? "Too High" : "Normal"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">Max: {thresholds.gas_max} ppm</p>
                  </CardContent>
                </Card>
              </div>

              {/* Last Update */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Last updated: {latestData?.timestamp ? formatTimestamp(latestData.timestamp) : "No data"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Alerts */}
            <TabsContent value="alerts" className="space-y-6">
              {/* Latest Alert */}
              {lastAlert && (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-red-800 dark:text-red-200">{lastAlert.type}</strong>
                        <p className="text-red-700 dark:text-red-300">Value: {lastAlert.value}</p>
                      </div>
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {formatTimestamp(lastAlert.timestamp)}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Alert History */}
              <Card>
                <CardHeader>
                  <CardTitle>Alert History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alertHistory.length > 0 ? (
                      alertHistory.map((alert, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{alert.type}</p>
                            <p className="text-sm text-muted-foreground">Value: {alert.value}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatTimestamp(alert.timestamp)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground">No alerts in history</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Historical Charts */}
            <TabsContent value="charts" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Historical Data</h2>
                <div className="flex space-x-2">
                  <div className="flex space-x-2">
                    {["1h", "6h", "24h"].map((range) => (
                      <Button
                        key={range}
                        variant={timeRange === range ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange(range)}
                      >
                        {range}
                      </Button>
                    ))}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button variant="outline" size="sm" onClick={exportToCSV}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>

              {/* Data Summary */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-sm text-muted-foreground">
                    Showing {filteredHistoricalData.length} data points from the last {timeRange}
                    {historicalData.length === 0 && " (No historical data available)"}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6">
                {/* Temperature Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Thermometer className="h-5 w-5" />
                      <span>Temperature Trend</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {filteredHistoricalData.length > 0 ? (
                      <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filteredHistoricalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                            <YAxis
                              tick={{ fontSize: 12 }}
                              label={{ value: "°C", angle: -90, position: "insideLeft" }}
                            />
                            <Tooltip
                              labelFormatter={(label) => `Time: ${label}`}
                              formatter={(value) => [`${value}°C`, "Temperature"]}
                            />
                            <Line
                              type="monotone"
                              dataKey="temp"
                              stroke="#ef4444"
                              strokeWidth={2}
                              dot={{ fill: "#ef4444", strokeWidth: 2, r: 3 }}
                              activeDot={{ r: 5, stroke: "#ef4444", strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Thermometer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No temperature data available for the selected time range</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Humidity Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Droplets className="h-5 w-5" />
                      <span>Humidity Trend</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {filteredHistoricalData.length > 0 ? (
                      <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filteredHistoricalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 12 }} label={{ value: "%", angle: -90, position: "insideLeft" }} />
                            <Tooltip
                              labelFormatter={(label) => `Time: ${label}`}
                              formatter={(value) => [`${value}%`, "Humidity"]}
                            />
                            <Line
                              type="monotone"
                              dataKey="humidity"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ fill: "#3b82f6", strokeWidth: 2, r: 3 }}
                              activeDot={{ r: 5, stroke: "#3b82f6", strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No humidity data available for the selected time range</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Gas Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Wind className="h-5 w-5" />
                      <span>Gas Level Trend</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {filteredHistoricalData.length > 0 ? (
                      <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filteredHistoricalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                            <YAxis
                              tick={{ fontSize: 12 }}
                              label={{ value: "ppm", angle: -90, position: "insideLeft" }}
                            />
                            <Tooltip
                              labelFormatter={(label) => `Time: ${label}`}
                              formatter={(value) => [`${value} ppm`, "Gas Level"]}
                            />
                            <Line
                              type="monotone"
                              dataKey="gas"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={{ fill: "#10b981", strokeWidth: 2, r: 3 }}
                              activeDot={{ r: 5, stroke: "#10b981", strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Wind className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No gas data available for the selected time range</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Threshold Settings */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Threshold Settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="temp_min">Temperature Min (°C)</Label>
                      <Input
                        id="temp_min"
                        type="number"
                        value={thresholds.temp_min}
                        onChange={(e) => setThresholds({ ...thresholds, temp_min: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temp_max">Temperature Max (°C)</Label>
                      <Input
                        id="temp_max"
                        type="number"
                        value={thresholds.temp_max}
                        onChange={(e) => setThresholds({ ...thresholds, temp_max: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="humidity_max">Humidity Max (%)</Label>
                      <Input
                        id="humidity_max"
                        type="number"
                        value={thresholds.humidity_max}
                        onChange={(e) => setThresholds({ ...thresholds, humidity_max: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gas_max">Gas Max (ppm)</Label>
                      <Input
                        id="gas_max"
                        type="number"
                        value={thresholds.gas_max}
                        onChange={(e) => setThresholds({ ...thresholds, gas_max: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <Button onClick={updateThresholds} className="w-full">
                    Update Thresholds
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
