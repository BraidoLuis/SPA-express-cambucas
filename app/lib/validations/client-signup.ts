export type ClientSignupData = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  emailNotifications: boolean;
  privacyAccepted: boolean;
};

export type SignupErrors = Partial<Record<keyof ClientSignupData, string>>;

export function normalizeBrazilianPhone(value: string) {
  return value.replace(/\D/g, "").replace(/^55/, "").slice(0, 11);
}

export function formatBrazilianPhone(value: string) {
  const digits = normalizeBrazilianPhone(value);
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
}

export function validateClientSignup(data: ClientSignupData): SignupErrors {
  const errors: SignupErrors = {};
  if (data.fullName.trim().split(/\s+/).length < 2) errors.fullName = "Informe nome e sobrenome.";
  if (normalizeBrazilianPhone(data.phone).length !== 11) errors.phone = "Informe um celular com DDD e 11 dígitos.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(data.email.trim())) errors.email = "Informe um e-mail válido.";
  if (data.password.length < 8 || !/[A-Z]/.test(data.password) || !/[a-z]/.test(data.password) || !/\d/.test(data.password)) errors.password = "Use 8 caracteres, com maiúscula, minúscula e número.";
  if (!data.confirmPassword) errors.confirmPassword = "Confirme sua senha.";
  else if (data.confirmPassword !== data.password) errors.confirmPassword = "As senhas precisam ser iguais.";
  if (!data.privacyAccepted) {
    errors.privacyAccepted =
      "Você precisa concordar com os Termos de Uso e estar ciente da Política de Privacidade.";
  }
  return errors;
}
