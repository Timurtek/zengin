import { Avatar, Badge, Button, Card, Checkbox, Icon, Separator, TextField, Toast, Tooltip, toast } from "@zenginui/ui";
import { useEffect, useState, type FormEvent } from "react";
import { emailError, findAccount, nameError, passwordError, RESET_CODE, SAMPLE, type Account } from "./data";

type View = "signin" | "signup" | "reset" | "code" | "done";
type Theme = "light" | "dark";

/** The theme lives on <html> so the tokens flow into toasts as well as the page. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === "light" || stamped === "dark") return stamped;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [view, setView] = useState<View>("signin");
  const [account, setAccount] = useState<Account | null>(null);
  const [email, setEmail] = useState("");

  return (
    <Tooltip.Provider>
      <Toast.Provider position="top-right">
        <div className="auth">
          <header className="auth__bar">
            <a className="auth__brand" href="#top" aria-label="Acme, home">
              <Avatar name="Acme" shape="square" size="sm" />
              <strong>Acme</strong>
            </a>
            <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
              <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme" leadingIcon={theme === "light" ? <Icon.Moon /> : <Icon.Sun />} />
            </Tooltip>
          </header>

          <main className="auth__main">
            <div className="auth__card z-rise">
              <Card padding="lg" variant="elevated">
                {view === "signin" && <SignIn email={email} onEmail={setEmail} onDone={(a) => { setAccount(a); setView("done"); }} onSignUp={() => setView("signup")} onReset={() => setView("reset")} />}
                {view === "signup" && <SignUp email={email} onEmail={setEmail} onDone={(a) => { setAccount(a); setView("done"); }} onSignIn={() => setView("signin")} />}
                {view === "reset" && <Reset email={email} onEmail={setEmail} onSent={() => setView("code")} onBack={() => setView("signin")} />}
                {view === "code" && <Code email={email} onVerified={() => { setAccount(findAccount(email) ?? null); setView("done"); }} onBack={() => setView("reset")} />}
                {view === "done" && <Done account={account} email={email} onSignOut={() => { setAccount(null); setView("signin"); }} />}
              </Card>
            </div>
            <p className="auth__hint">
              Try <code>{SAMPLE.email}</code> with any password of eight characters. The accounts come from <code>mock.json</code>.
            </p>
          </main>

          <footer className="auth__foot">
            <a href="#terms">Terms</a>
            <a href="#privacy">Privacy</a>
            <a href="#help">Help</a>
          </footer>
        </div>
      </Toast.Provider>
    </Tooltip.Provider>
  );
}

function SignIn({ email, onEmail, onDone, onSignUp, onReset }: { email: string; onEmail: (v: string) => void; onDone: (a: Account | null) => void; onSignUp: () => void; onReset: () => void }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const errors = { email: emailError(email), password: passwordError(password) };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.email || errors.password) return;
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      const a = findAccount(email);
      if (!a) {
        toast({ title: "No account with that email", description: "Create one, or check the address.", tone: "danger" });
        return;
      }
      onDone(a);
    }, 600);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__head">
        <h1>Sign in</h1>
        <p>Welcome back. Your workspace is where you left it.</p>
      </div>
      <div className="form__alt">
        <Button variant="soft" leadingIcon={<Icon.Shield />} onClick={() => toast({ title: "SSO is not wired in this demo", description: "Point the button at your identity provider." })}>
          Continue with SSO
        </Button>
      </div>
      <Separator label="or" />
      <div className="form__fields">
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => onEmail(e.target.value)} error={touched ? errors.email : undefined} leadingIcon={<Icon.Mail />} />
        <TextField
          label="Password"
          type={show ? "text" : "password"}
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={touched ? errors.password : undefined}
          leadingIcon={<Icon.Lock />}
          trailingIcon={
            <Button type="button" variant="ghost" size="sm" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} leadingIcon={show ? <Icon.EyeOff /> : <Icon.Eye />} />
          }
        />
        <div className="form__row">
          <Checkbox label="Keep me signed in" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
          <Button variant="link" size="sm" onClick={onReset}>
            Forgot password?
          </Button>
        </div>
      </div>
      <Button type="submit" tone="primary" size="lg" loading={busy} className="form__submit">
        Sign in
      </Button>
      <p className="form__switch">
        New here?{" "}
        <Button variant="link" size="sm" onClick={onSignUp}>
          Create an account
        </Button>
      </p>
    </form>
  );
}

function SignUp({ email, onEmail, onDone, onSignIn }: { email: string; onEmail: (v: string) => void; onDone: (a: Account | null) => void; onSignIn: () => void }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const taken = findAccount(email);
  const errors = { name: nameError(name), email: emailError(email) ?? (taken ? "An account with this email exists. Sign in instead." : undefined), password: passwordError(password) };
  const strength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length > 0 ? 1 : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.name || errors.email || errors.password) return;
    if (!agree) {
      toast({ title: "Accept the terms to continue", tone: "warning" });
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      toast({ title: "Account created", description: `Welcome, ${name.trim()}.`, tone: "success" });
      onDone({ id: "USR-new", name: name.trim(), email: email.trim(), role: "member", joined: "2026-09-12" });
    }, 700);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__head">
        <h1>Create your account</h1>
        <p>Free for one workspace. No card.</p>
      </div>
      <div className="form__fields">
        <TextField label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={touched ? errors.name : undefined} leadingIcon={<Icon.User />} />
        <TextField label="Work email" type="email" autoComplete="email" value={email} onChange={(e) => onEmail(e.target.value)} error={touched || taken ? errors.email : undefined} leadingIcon={<Icon.Mail />} />
        <TextField
          label="Password"
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={touched ? errors.password : undefined}
          description={<Strength level={strength} />}
          leadingIcon={<Icon.Lock />}
        />
        <Checkbox label="I agree to the terms and the privacy policy" checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
      </div>
      <Button type="submit" tone="primary" size="lg" loading={busy} className="form__submit">
        Create account
      </Button>
      <p className="form__switch">
        Already have one?{" "}
        <Button variant="link" size="sm" onClick={onSignIn}>
          Sign in
        </Button>
      </p>
    </form>
  );
}

function Strength({ level }: { level: 0 | 1 | 2 | 3 }) {
  const words = ["Eight characters or more", "Too short", "Good", "Strong"];
  return (
    <span className="strength" data-level={level}>
      <span className="strength__bar" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {words[level]}
    </span>
  );
}

function Reset({ email, onEmail, onSent, onBack }: { email: string; onEmail: (v: string) => void; onSent: () => void; onBack: () => void }) {
  const [touched, setTouched] = useState(false);
  const error = emailError(email);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (error) return;
    toast({ title: "Code sent", description: `If ${email.trim()} has an account, a six-digit code is on its way.`, tone: "success" });
    onSent();
  };
  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__head">
        <h1>Reset your password</h1>
        <p>Enter your email and we will send a code.</p>
      </div>
      <div className="form__fields">
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => onEmail(e.target.value)} error={touched ? error : undefined} leadingIcon={<Icon.Mail />} />
      </div>
      <Button type="submit" tone="primary" size="lg" className="form__submit">
        Send code
      </Button>
      <p className="form__switch">
        <Button variant="link" size="sm" onClick={onBack} leadingIcon={<Icon.ArrowLeft />}>
          Back to sign in
        </Button>
      </p>
    </form>
  );
}

function Code({ email, onVerified, onBack }: { email: string; onVerified: () => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim() !== RESET_CODE) {
      setError("That code is not right. The demo's code is in the hint below.");
      return;
    }
    toast({ title: "Password reset", description: "You are signed in.", tone: "success" });
    onVerified();
  };
  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form__head">
        <h1>Check your email</h1>
        <p>
          We sent a code to <strong>{email.trim()}</strong>.
        </p>
      </div>
      <div className="form__fields">
        <TextField label="Six-digit code" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value); setError(undefined); }} error={error} description={`For the demo: ${RESET_CODE}`} />
      </div>
      <Button type="submit" tone="primary" size="lg" className="form__submit">
        Verify
      </Button>
      <p className="form__switch">
        <Button variant="link" size="sm" onClick={onBack} leadingIcon={<Icon.ArrowLeft />}>
          Use a different email
        </Button>
      </p>
    </form>
  );
}

function Done({ account, email, onSignOut }: { account: Account | null; email: string; onSignOut: () => void }) {
  const name = account?.name ?? email.trim();
  return (
    <div className="form">
      <div className="done">
        <Avatar name={name} size="xl" />
        <div className="form__head">
          <h1>Signed in</h1>
          <p>
            {name}
            {account && (
              <>
                {" "}
                <Badge size="sm" tone={account.role === "owner" ? "primary" : "neutral"}>
                  {account.role}
                </Badge>
              </>
            )}
          </p>
        </div>
        <dl className="done__facts">
          <dt>Email</dt>
          <dd>{account?.email ?? email.trim()}</dd>
          <dt>Member since</dt>
          <dd>{account ? account.joined : "today"}</dd>
        </dl>
      </div>
      <Button tone="primary" size="lg" className="form__submit" trailingIcon={<Icon.ArrowRight />} onClick={() => toast({ title: "This is where the app starts", description: "Route to your dashboard here." })}>
        Open workspace
      </Button>
      <p className="form__switch">
        <Button variant="link" size="sm" onClick={onSignOut} leadingIcon={<Icon.LogOut />}>
          Sign out
        </Button>
      </p>
    </div>
  );
}
