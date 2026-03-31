export default function TechStackCard({ t, cardClass }) {
  return (
    <div className={cardClass}>
      <div className="p-4 md:p-6">
        <h2
          className={`text-lg md:text-xl font-semibold mb-4 ${t(
            "text-white",
            "text-gray-900"
          )}`}
        >
          Technology Stack
        </h2>
        <div
          className={`text-xs md:text-sm ${t(
            "text-gray-400",
            "text-gray-600"
          )}`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold mb-2">Frontend</p>
              <ul className="space-y-1">
                <li>• React 18</li>
                <li>• React Router DOM</li>
                <li>• TanStack Query (React Query)</li>
                <li>• Tailwind CSS</li>
                <li>• React Icons</li>
                <li>• React Toastify</li>
                <li>• Axios</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">Backend</p>
              <ul className="space-y-1">
                <li>• Node.js + Express</li>
                <li>• PostgreSQL</li>
                <li>• Prisma ORM</li>
                <li>• JWT Authentication</li>
                <li>• Telegram Bot API</li>
                <li>• bcrypt</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
