const COMMON = new Set(["password123", "heslo123", "qwerty123", "123456789", "admin123", "vianema123", "makler123", "Password1!", "Heslo123!"]);

export function validatePasswordStrength(password: string) {
  const rules = {
    minLength:    password.length >= 10,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber:    /[0-9]/.test(password),
    hasSpecial:   /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    notCommon:    !COMMON.has(password.toLowerCase()),
  };
  const passed = Object.values(rules).filter(Boolean).length;
  const valid = Object.values(rules).every(Boolean);
  const missing: string[] = [];
  if (!rules.minLength)    missing.push("aspoň 10 znakov");
  if (!rules.hasUppercase) missing.push("veľké písmeno");
  if (!rules.hasLowercase) missing.push("malé písmeno");
  if (!rules.hasNumber)    missing.push("číslicu");
  if (!rules.hasSpecial)   missing.push("špeciálny znak (!@#$...)");
  if (!rules.notCommon)    missing.push("originálnejšie heslo");
  return {
    valid,
    score: passed,
    rules,
    message: valid ? "Heslo je silné" : `Heslo musí obsahovať: ${missing.join(", ")}`,
  };
}
