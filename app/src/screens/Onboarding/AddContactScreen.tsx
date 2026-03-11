import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addFlaggedContact } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AddContactScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      setError("Name and phone number are required.");
      return;
    }
    addFlaggedContact({ name: trimmedName, phoneNumber: trimmedPhone });
    navigate("/onboarding/set");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background py-12 sm:py-16">
      <div className="mx-auto w-full max-w-content space-y-8 px-4 sm:px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add your ex's contact</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We'll use this so NOTSENT knows who to protect you from.
          </p>
        </div>
        <Card className="mx-auto max-w-md rounded-xl shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
            <CardDescription>Name and phone number</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              <Input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">Continue</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
