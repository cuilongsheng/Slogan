import { createContext, useContext, useState } from 'react';

type Enrollment = { email: string; managementToken: string; resendAt: string };
type EmailFlow = {
  enrollment: Enrollment | null;
  setEnrollment(value: Enrollment | null): void;
};

const EmailFlowContext = createContext<EmailFlow | null>(null);

export function EmailFlowProvider({ children }: { children: React.ReactNode }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  return (
    <EmailFlowContext.Provider value={{ enrollment, setEnrollment }}>
      {children}
    </EmailFlowContext.Provider>
  );
}

export function useEmailFlow(): EmailFlow {
  const flow = useContext(EmailFlowContext);
  if (!flow) throw new Error('EmailFlowProvider is required');
  return flow;
}
