/**
 * Register Page Component
 */
export default function RegisterPage() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Create Account</h2>
      <form className="space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          className="w-full px-3 py-2 border rounded-lg"
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full px-3 py-2 border rounded-lg"
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full px-3 py-2 border rounded-lg"
        />
        <button className="w-full bg-blue-600 text-white py-2 rounded-lg">
          Create Account
        </button>
      </form>
    </div>
  )
}