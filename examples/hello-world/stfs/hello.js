// Simple greeting STF for the hello-world d6e App example.
// Returns a personalized greeting message.
export default function (input) {
  const name = input.name || 'World';
  return { message: `Hello, ${name}!` };
}
