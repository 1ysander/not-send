import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/Container";

export function YoureSetScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background py-12 sm:py-16">
      <Container narrow className="flex justify-center">
        <Card className="w-full max-w-md rounded-xl shadow-card">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">You're set</CardTitle>
            <CardDescription>
              When you want to text them, open NOTSENT and type here instead. We'll intercept send and open a calm chat so you process the impulse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} size="lg" className="w-full rounded-lg">
              Open NOTSENT
            </Button>
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}
