import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { LogOut, Send, Activity, FileText, DollarSign, UserCheck, FileEdit } from "lucide-react";
import PatientSelector from "@/components/PatientSelector";
import VoiceInput from "@/components/VoiceInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface Patient {
  id: string;
  full_name: string;
  medical_record_number: string | null;
}
interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  taskType?: string;
  modelUsed?: string;
  timestamp: Date;
}
const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [taskType, setTaskType] = useState<string>("ehr");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  useEffect(() => {
    if (selectedPatient) {
      loadConversations();
    }
  }, [selectedPatient]);
  const loadConversations = async () => {
    if (!selectedPatient) return;
    const {
      data,
      error
    } = await supabase.from("conversations").select("*").eq("patient_id", selectedPatient.id).order("created_at");
    if (error) {
      toast({
        title: "Error loading conversations",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    const formattedMessages: Message[] = [];
    data?.forEach(conv => {
      formattedMessages.push({
        id: conv.id,
        type: "user",
        content: conv.user_input,
        taskType: conv.task_type,
        timestamp: new Date(conv.created_at)
      });
      if (conv.ai_response) {
        formattedMessages.push({
          id: `${conv.id}-response`,
          type: "assistant",
          content: conv.ai_response,
          modelUsed: conv.model_used,
          timestamp: new Date(conv.created_at)
        });
      }
    });
    setMessages(formattedMessages);
  };
  const handleSend = async () => {
    if (!input.trim() || !selectedPatient) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      taskType,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("route-medical-task", {
        body: {
          patientId: selectedPatient.id,
          taskType,
          input: input
        }
      });
      if (error) throw error;
      const assistantMessage: Message = {
        id: `${Date.now()}-response`,
        type: "assistant",
        content: data.response,
        modelUsed: data.modelUsed,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleVoiceTranscription = (text: string, audioPath: string) => {
    setInput(text);
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  const getTaskIcon = (type: string) => {
    switch (type) {
      case "ehr":
        return <FileText className="w-4 h-4" />;
      case "billing":
        return <DollarSign className="w-4 h-4" />;
      case "patient_details":
        return <UserCheck className="w-4 h-4" />;
      case "referral_letter":
        return <FileEdit className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };
  if (!user) return null;
  return <div className="flex flex-col h-screen bg-gradient-to-br from-background via-primary-soft/30 to-secondary/10">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm shadow-medical bg-card-foreground">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">MedRoute</h1>
              <p className="text-xs text-muted-foreground">AI Medical Assistant</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Patient Selector */}
      <PatientSelector selectedPatient={selectedPatient} onSelectPatient={setSelectedPatient} className="bg-card-foreground" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-card-foreground">
        {messages.length === 0 ? <div className="flex items-center justify-center h-full bg-sidebar-primary">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center opacity-50">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-muted-foreground">
                {selectedPatient ? "Start a conversation" : "Select a patient to begin"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose a task type and start documenting with voice or text
              </p>
            </div>
          </div> : messages.map(message => <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl p-4 shadow-md transition-all duration-300 ${message.type === "user" ? "bg-gradient-to-br from-primary to-secondary text-white" : "bg-card border border-border"}`}>
                {message.taskType && message.type === "user" && <div className="flex items-center gap-2 mb-2 text-xs opacity-90">
                    {getTaskIcon(message.taskType)}
                    <span className="capitalize">{message.taskType.replace("_", " ")}</span>
                  </div>}
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.modelUsed && <p className="text-xs mt-2 opacity-70">Model: {message.modelUsed}</p>}
              </div>
            </div>)}
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 backdrop-blur-sm p-4 bg-card-foreground">
        <div className="container mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ehr">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    EHR Documentation
                  </div>
                </SelectItem>
                <SelectItem value="billing">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Billing
                  </div>
                </SelectItem>
                <SelectItem value="patient_details">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    Patient Details
                  </div>
                </SelectItem>
                <SelectItem value="referral_letter">
                  <div className="flex items-center gap-2">
                    <FileEdit className="w-4 h-4" />
                    Referral Letter
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }} placeholder="Describe the medical task or speak..." disabled={!selectedPatient || loading} className="min-h-[60px] resize-none transition-all duration-200 focus:ring-2 focus:ring-primary" />
            <div className="flex gap-2">
              <VoiceInput onTranscriptionComplete={handleVoiceTranscription} conversationId={null} disabled={!selectedPatient || loading} />
              <Button onClick={handleSend} disabled={!selectedPatient || !input.trim() || loading} className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300">
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default Index;