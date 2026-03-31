export default function AboutCard({ t, cardClass }) {
  return (
    <div className={cardClass}>
      <div className="p-4 md:p-6">
        <h2
          className={`text-lg md:text-xl font-semibold mb-4 ${t(
            "text-white",
            "text-gray-900"
          )}`}
        >
          About
        </h2>
        <div
          className={`space-y-1 text-xs md:text-sm ${t(
            "text-gray-400",
            "text-gray-600"
          )}`}
        >
          <p className="font-medium">Crypto Analyze — Full Stack Application</p>
          <p>Version 2.0.0</p>
          <p>
            Built with React, Node.js, PostgreSQL, and modern web technologies
          </p>
        </div>
      </div>
    </div>
  );
}
