import { GoogleLogin } from "@react-oauth/google";
import { useDarkMode } from "../../contexts/DarkModeContext";

// GoogleAuthButton: fungsi/komponen ini menangani UI dan alur sesuai props yang diberikan.
export function GoogleAuthButton({ onSuccess, onError, text }) {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
        theme={isDarkMode ? "filled_black" : "outline"}
        size="large"
        text={text}
        shape="rectangular"
        logo_alignment="left"
      />
    </div>
  );
}

export default GoogleAuthButton;
