import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  // body is overflow:hidden (globals.css), so this <main> scrolls itself:
  // with min-h-screen alone the card's lower half (and its submit button) was
  // unreachable on short or landscape phones and with the keyboard open.
  return (
    <main className="h-full overflow-y-auto">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <SignIn />
      </div>
    </main>
  );
}
