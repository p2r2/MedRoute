import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, UserCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
interface Patient {
  id: string;
  full_name: string;
  medical_record_number: string | null;
}
interface PatientSelectorProps {
  selectedPatient: Patient | null;
  onSelectPatient: (patient: Patient | null) => void;
}
const PatientSelector = ({
  selectedPatient,
  onSelectPatient
}: PatientSelectorProps) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientMRN, setNewPatientMRN] = useState("");
  const {
    toast
  } = useToast();
  useEffect(() => {
    loadPatients();
  }, []);
  const loadPatients = async () => {
    const {
      data: user
    } = await supabase.auth.getUser();
    if (!user.user) return;
    const {
      data,
      error
    } = await supabase.from("patients").select("id, full_name, medical_record_number").eq("doctor_id", user.user.id).order("full_name");
    if (error) {
      toast({
        title: "Error loading patients",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    setPatients(data || []);
  };
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: user
    } = await supabase.auth.getUser();
    if (!user.user) return;
    const {
      data,
      error
    } = await supabase.from("patients").insert({
      doctor_id: user.user.id,
      full_name: newPatientName,
      medical_record_number: newPatientMRN || null
    }).select().single();
    if (error) {
      toast({
        title: "Error adding patient",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    setPatients([...patients, data]);
    setNewPatientName("");
    setNewPatientMRN("");
    setDialogOpen(false);
    toast({
      title: "Patient added",
      description: "New patient has been added successfully."
    });
  };
  return <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <UserCircle className="w-5 h-5 text-primary" />
            <select value={selectedPatient?.id || ""} onChange={e => {
            const patient = patients.find(p => p.id === e.target.value);
            onSelectPatient(patient || null);
          }} className="flex-1 bg-background border border-input rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary transition-all">
              <option value="">Select a patient...</option>
              {patients.map(patient => <option key={patient.id} value={patient.id}>
                  {patient.full_name}
                  {patient.medical_record_number && ` (MRN: ${patient.medical_record_number})`}
                </option>)}
            </select>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-primary-foreground">
                <Plus className="w-4 h-4" />
                Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Patient</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPatient} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="patientName">Patient Name</Label>
                  <Input id="patientName" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} required placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mrn">Medical Record Number (Optional)</Label>
                  <Input id="mrn" value={newPatientMRN} onChange={e => setNewPatientMRN(e.target.value)} placeholder="MRN-12345" />
                </div>
                <Button type="submit" className="w-full">
                  Add Patient
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>;
};
export default PatientSelector;