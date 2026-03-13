import {IconButton, InputAdornment, TextField, TextFieldProps} from "@/components/ui/primitives";
import { Eye as Visibility, EyeOff as VisibilityOff } from "lucide-react";
import {useState} from "react";

export default function PasswordField(props: TextFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const showButton = (
    <InputAdornment position="end">
      <IconButton onClick={() => setShowPassword(!showPassword)}>
        {showPassword ? <VisibilityOff /> : <Visibility />}
      </IconButton>
    </InputAdornment>
  );

  return <TextField
    {...props}
    type={showPassword ? 'text' : 'password'}
    InputProps={{ endAdornment: showButton }} />
}
