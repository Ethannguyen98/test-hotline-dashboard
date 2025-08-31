import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ChevronRight, Clock, Download, RefreshCcw, Users, Headphones, MessageCircle, PhoneOff, Eye } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const INITIAL_AGENTS = [
  { id: "A01", name: "Jane Nguyen", status: "Available", timeInStatus: 120 },
  { id: "A02", name: "Minh Tran", status: "On Call", timeInStatus: 540 },
  { id: "A03", name: "Linh Pham", status: "Not Ready", timeInStatus: 300 },
  { id: "A04", name: "Khoa Le", status: "On Call", timeInStatus: 60 },
  { id: "A05", name: "Anh Vu", status: "Available", timeInStatus: 30 }
];

const QUEUES = [
  { id: 2, name: "Queue 2" },
  { id: 4, name: "Queue 4" }
];

function seedSeries() {
  const now = new Date();
  const pts = [];
  let baseIn = 10;
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 5 * 60 * 1000);
    baseIn += Math.round((Math.random() - 0.5) * 6);
    const inbound = Math.max(0, baseIn);
    const answered = Math.max(0, inbound - Math.round(Math.random() * 4));
    const abandoned = Math.max(0, inbound - answered - Math.round(Math.random() * 2));
    pts.push({ t: d.toTimeString().slice(0, 5), inbound, answered, abandoned });
  }
  return pts;
}

const SLA_TARGET = 0.8;
const WAIT_THRESHOLD = 20;
const CSAT_MAP = { 1: "Good", 2: "Average", 3: "Bad" };

function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function statusColor(status) {
  switch (status) {
    case "Available":
      return "bg-emerald-100 text-emerald-700";
    case "On Call":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function lastItem(arr) {
  const a = safeArray(arr);
  return a.length ? a[a.length - 1] : null;
}

export default function HotlineDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [queue, setQueue] = useState("2");
  const [series, setSeries] = useState(() => seedSeries());
  const [agents, setAgents] = useState(() => safeArray(INITIAL_AGENTS));
  const [directionFilter, setDirectionFilter] = useState("all");
  const [distributionRange, setDistributionRange] = useState("24h");
  const [liveCalls, setLiveCalls] = useState(() => [
    { id: 1, caller: "+84901234567", agentId: "A02", agentName: "Minh Tran", queue: "CS-2", startedAt: new Date(), durationSec: 135, recordingUrl: "/mock/rec1.mp3" },
    { id: 2, caller: "+84987654321", agentId: "A04", agentName: "Khoa Le", queue: "CS-4", startedAt: new Date(), durationSec: 55, recordingUrl: "/mock/rec2.mp3" }
  ]);

  const [detailedRows] = useState(() => {
    const baseAgents = safeArray(INITIAL_AGENTS);
    const rows = [];
    for (let i = 0; i < 30; i++) {
      const ag = baseAgents[i % baseAgents.length] || { name: "Unknown" };
      rows.push({
        id: 2000 + i,
        time: new Date(Date.now() - i * 3600_000).toISOString().slice(0, 16).replace("T", " "),
        direction: Math.random() > 0.6 ? "Outbound" : "Inbound",
        queue: i % 2 ? "CS-SPX-1" : "CS-SPX-2",
        agent: ag.name,
        name: ag.name,
        phone: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
        status: ["COMPLETECALLER", "COMPLETEAGENT", "ABANDONED (1)", "REJECTED (2)", "ABANDONED BUSY (3)"][Math.floor(Math.random() * 5)],
        wait: `00:00:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
        hold: `00:00:${String(Math.floor(Math.random() * 20)).padStart(2, "0")}`,
        talk: `00:${String(Math.floor(1 + Math.random() * 9)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
        endBy: Math.random() > 0.5 ? "Agent" : "User",
        csat: Math.random() > 0.7 ? 1 : Math.random() > 0.4 ? 2 : 3,
        recordingUrl: Math.random() > 0.3 ? "/mock/rec.mp3" : null
      });
    }
    return rows;
  });

  const kpis = useMemo(() => {
    const cur = lastItem(series) || { inbound: 0, answered: 0, abandoned: 0 };
    const inbound = Number(cur.inbound ?? 0);
    const answered = Number(cur.answered ?? 0);
    const abandoned = Number(cur.abandoned ?? 0);
    const callsInQueue = Math.max(0, inbound - answered);
    const answeredWithinSLA = Math.round(answered * (0.75 + Math.random() * 0.2));
    const sla = answered ? answeredWithinSLA / answered : 0;
    const asa = 20 + Math.round(Math.random() * 30);
    const dropped = Math.max(0, abandoned - Math.round(Math.random() * 2));
    const loggedIn = safeArray(agents).length;
    const available = safeArray(agents).filter(a => a && a.status === "Available").length;
    return { callsInQueue, sla, asa, dropped, loggedIn, available };
  }, [series, agents]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      setSeries(prev => {
        const prevArr = safeArray(prev);
        const next = prevArr.slice();
        if (next.length) next.shift();
        const now = new Date();
        const inbound = Math.max(0, Math.round(8 + Math.random() * 14));
        const answered = Math.max(0, inbound - Math.round(Math.random() * 5));
        const abandoned = Math.max(0, inbound - answered);
        next.push({ t: now.toTimeString().slice(0, 5), inbound, answered, abandoned });
        return next;
      });
      setAgents(prev => safeArray(prev).map(ag => {
        const roll = Math.random();
        let status = ag.status;
        if (roll > 0.8) status = "Available";
        else if (roll > 0.55) status = "On Call";
        else if (roll > 0.4) status = "Not Ready";
        return { ...ag, status, timeInStatus: status === ag.status ? (ag.timeInStatus ?? 0) + 15 : 0 };
      }));
      setLiveCalls(prev => safeArray(prev).map(c => ({ ...c, durationSec: (c.durationSec ?? 0) + 15 })));
      setLastUpdated(new Date());
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const alerts = [
    kpis.sla < SLA_TARGET ? { type: "error", text: "SLA < 80%" } : null,
    kpis.callsInQueue > WAIT_THRESHOLD ? { type: "warn", text: "Queue length > 20" } : null
  ].filter(Boolean);

  const callsByHour = useMemo(() => {
    const pts = [];
    const hours = distributionRange === "24h" ? 24 : distributionRange === "12h" ? 12 : 6;
    const now = new Date();
    for (let i = hours - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      pts.push({ hour: d.getHours().toString().padStart(2, "0") + ":00", calls: Math.round(5 + Math.random() * 25) });
    }
    return pts;
  }, [distributionRange]);

  const callsByAgent = useMemo(() => {
    return safeArray(agents).map(a => ({ name: a?.name ?? "Unknown", value: Math.round(5 + Math.random() * 40) }));
  }, [agents]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vendor, setVendor] = useState("all");

  const filteredRows = useMemo(() => {
    const rows = safeArray(detailedRows);
    return rows.filter(r => r && (directionFilter === "all" || r.direction === directionFilter));
  }, [detailedRows, directionFilter]);

  function handleSpy(callId) { alert(`Spy on call ${callId} (demo)`); }
  function handleWhisper(callId) { alert(`Whisper to agent on call ${callId} (demo)`); }
  function handleHangup(callId) { alert(`Force hangup call ${callId} (demo)`); }
  function handleChat(callId) { alert(`Open chat with agent for call ${callId} (demo)`); }
  function handlePlay(url) { if (!url) { alert('No recording available'); return; } window.open(url, '_blank'); }

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hotline Dashboard</h1>
        <div className="flex items-center gap-4">
          <Select value={queue} onValueChange={setQueue}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Queue" /></SelectTrigger>
            <SelectContent>
              {safeArray(QUEUES).map(q => (<SelectItem key={q.id} value={String(q.id)}>{q.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Direction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Inbound">Inbound</SelectItem>
              <SelectItem value="Outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setLastUpdated(new Date())}>
            <RefreshCcw className="h-4 w-4 mr-2"/>Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="realtime" className="space-y-6">
        <TabsList className="rounded-2xl bg-white shadow p-1">
          <TabsTrigger value="realtime">Realtime Monitoring</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="realtime" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <KpiCard title="Calls in Queue" value={kpis.callsInQueue ?? 0} subtitle={`Queue ${queue}`} intent={kpis.callsInQueue > WAIT_THRESHOLD ? "danger" : "info"} />
            <KpiCard title="Available Agents" value={kpis.available ?? 0} subtitle={`${kpis.loggedIn ?? 0} logged-in`} intent="success" />
            <KpiCard title="% Answer within 5s" value={`${Math.round((kpis.sla ?? 0) * 100)}%`} subtitle="SLA (target 80%)" intent={kpis.sla < SLA_TARGET ? "danger" : "success"} />
            <KpiCard title="Avg Speed of Answer" value={`${kpis.asa ?? 0}s`} subtitle="ASA (sec)" intent={kpis.asa > 40 ? "warn" : "info"} />
            <KpiCard title="Dropped Calls" value={kpis.dropped ?? 0} subtitle="last 5m" intent={kpis.dropped > 5 ? "warn" : "info"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Live Calls (Realtime)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left">Caller</th>
                      <th className="p-2 text-left">Agent</th>
                      <th className="p-2 text-left">Queue</th>
                      <th className="p-2 text-left">Duration</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeArray(liveCalls).length > 0 ? safeArray(liveCalls).map(c => (
                      <tr key={c.id} className="border-t">
                        <td className="p-2">{c.caller}</td>
                        <td className="p-2">{c.agentName}</td>
                        <td className="p-2">{c.queue}</td>
                        <td className="p-2">{Math.floor((c.durationSec ?? 0) / 60)}:{String((c.durationSec ?? 0) % 60).padStart(2, '0')}</td>
                        <td className="p-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleSpy(c.id)}><Eye className="w-4 h-4"/> Spy</Button>
                          <Button size="sm" variant="outline" onClick={() => handleWhisper(c.id)}><MessageCircle className="w-4 h-4"/> Whisper</Button>
                          <Button size="sm" variant="outline" onClick={() => handleHangup(c.id)}><PhoneOff className="w-4 h-4"/> Hangup</Button>
                          <Button size="sm" variant="outline" onClick={() => handleChat(c.id)}><MessageCircle className="w-4 h-4"/> Chat</Button>
                          {c.recordingUrl ? <Button size="sm" variant="ghost" onClick={() => handlePlay(c.recordingUrl)}><Headphones className="w-4 h-4"/> Play</Button> : null}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="text-center text-slate-500 py-6">No live calls</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle>Call Volume (last 60m)</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={safeArray(series)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="inbound" stroke="#1d4ed8" strokeWidth={2} name="Inbound" />
                    <Line type="monotone" dataKey="answered" stroke="#059669" strokeWidth={2} name="Answered" />
                    <Line type="monotone" dataKey="abandoned" stroke="#dc2626" strokeWidth={2} name="Abandoned" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle>Alerts</CardTitle>
                <AlertTriangle className={`h-5 w-5 ${safeArray(alerts).length ? "text-red-500" : "text-slate-300"}`} />
              </CardHeader>
              <CardContent className="space-y-3">
                {safeArray(alerts).length === 0 && (
                  <div className="text-sm text-slate-500">All good. No active alerts.</div>
                )}
                {safeArray(alerts).map((a, idx) => (
                  <div key={idx} className={`flex items-center gap-2 text-sm ${a.type === "error" ? "text-red-600" : "text-amber-600"}`}>
                    <ChevronRight className="h-4 w-4" />{a.text}
                  </div>
                ))}
                <div className="pt-4 border-t mt-2 text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</div>
                <div className="flex items-center gap-2"><Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto" /><Label htmlFor="auto">Auto-refresh</Label></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2 flex items-center justify-between">
              <CardTitle className="text-base">Agent Live Status</CardTitle>
              <div className="text-xs text-slate-500 flex items-center gap-2"><Users className="h-4 w-4"/> {kpis.loggedIn} logged-in</div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-2">Agent</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Time in Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeArray(agents).length > 0 ? safeArray(agents).map(a => (
                      <tr key={a.id} className="border-b">
                        <td className="p-2">{a.name}</td>
                        <td className="p-2"><span className={`px-2 py-1 rounded-full text-xs ${statusColor(a.status)}`}>{a.status}</span></td>
                        <td className="p-2">{Math.floor((a.timeInStatus ?? 0)/60)}m {(a.timeInStatus ?? 0)%60}s</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="text-center text-slate-500 py-6">No agents</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-6">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-1">
                <Label>Date from</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <Label>Date to</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <Label>Direction</Label>
                <Select value={directionFilter} onValueChange={setDirectionFilter}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Inbound">Inbound</SelectItem>
                    <SelectItem value="Outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1">
                <Label>Vendor</Label>
                <Select value={vendor} onValueChange={setVendor}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="vendor-a">Vendor A</SelectItem>
                    <SelectItem value="vendor-b">Vendor B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex items-end justify-end gap-2">
                <Select value={distributionRange} onValueChange={setDistributionRange}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Distribution range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6h">Last 6 hours</SelectItem>
                    <SelectItem value="12h">Last 12 hours</SelectItem>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline"><Download className="h-4 w-4 mr-2"/>Export CSV</Button>
                <Button>Apply</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle>Answered vs Abandoned (by period)</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={safeArray(series).map(s => ({ name: s.t, answered: s.answered, abandoned: s.abandoned }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="answered" stackId="a" fill="#10b981" />
                    <Bar dataKey="abandoned" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle>SLA & ASA Trend</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={safeArray(series).map(s => ({ name: s.t, sla: 0.7 + Math.random() * 0.3, asa: 10 + Math.random() * 40 }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sla" stroke="#3b82f6" name="SLA" />
                    <Line type="monotone" dataKey="asa" stroke="#f59e0b" name="ASA (s)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Distribution by Hours</CardTitle></CardHeader>
              <CardContent className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={safeArray(callsByHour)}>
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="calls" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Distribution by Agent</CardTitle></CardHeader>
              <CardContent className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={safeArray(callsByAgent)} dataKey="value" nameKey="name" outerRadius={80} label>
                      {safeArray(callsByAgent).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={["#0088FE", "#FF8042", "#00C49F"][index % 3]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle>Call List</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left">Call ID</th>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Direction</th>
                      <th className="p-2 text-left">Queue</th>
                      <th className="p-2 text-left">Agent</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Phone</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Wait</th>
                      <th className="p-2 text-left">Hold</th>
                      <th className="p-2 text-left">Talk</th>
                      <th className="p-2 text-left">End By</th>
                      <th className="p-2 text-left">CSAT</th>
                      <th className="p-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!safeArray(filteredRows).length ? (
                      <tr>
                        <td colSpan={14} className="text-center text-slate-500 py-6">No call logs found for selected filters</td>
                      </tr>
                    ) : (
                      safeArray(filteredRows).map(r => (
                        <tr key={r.id} className="border-b hover:bg-slate-50">
                          <td className="p-2">#{r.id}</td>
                          <td className="p-2">{r.time}</td>
                          <td className="p-2">{r.direction}</td>
                          <td className="p-2">{r.queue}</td>
                          <td className="p-2">{r.agent}</td>
                          <td className="p-2">{r.name}</td>
                          <td className="p-2">{r.phone}</td>
                          <td className="p-2">{r.status}</td>
                          <td className="p-2">{r.wait}</td>
                          <td className="p-2">{r.hold}</td>
                          <td className="p-2">{r.talk}</td>
                          <td className="p-2">{r.endBy}</td>
                          <td className="p-2">{CSAT_MAP[r.csat] ?? "N/A"}</td>
                          <td className="p-2 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handlePlay(r.recordingUrl)}><Headphones className="w-4 h-4"/> Play</Button>
                            {r.recordingUrl ? <Button size="sm" variant="outline" onClick={() => window.open(r.recordingUrl, '_blank')}><Download className="w-4 h-4"/>Download</Button> : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-xs text-slate-500 flex items-center gap-2">
        <Clock className="h-4 w-4"/>Last updated {lastUpdated.toLocaleString()} · Demo data only
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, intent }) {
  const palette = {
    info: "bg-slate-50 border-slate-200",
    success: "bg-emerald-50 border-emerald-200",
    warn: "bg-amber-50 border-amber-200",
    danger: "bg-red-50 border-red-200"
  };
  return (
    <Card className={`border ${palette[intent ?? "info"]} rounded-2xl`}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
        <div className="text-3xl font-bold mt-1">{value}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}
