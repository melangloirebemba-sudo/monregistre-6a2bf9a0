import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
}

export function OtpCodeInput({ value, onChange, id = "otp", label = "Code reçu par SMS", disabled }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete="one-time-code"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        className="text-center font-mono text-lg tracking-[0.4em]"
      />
    </div>
  );
}
