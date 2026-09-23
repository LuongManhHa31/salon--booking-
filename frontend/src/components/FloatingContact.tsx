export function FloatingContact() {
  const phoneNumber = "0345607361";
  const zaloUrl = "https://zalo.me/" + phoneNumber;

  const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 relative z-10">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
    </svg>
  );

  return (
    <div className="fixed bottom-6 left-6 flex flex-col gap-4 z-50">
      {/* Nút Zalo */}
      <a
        href={zaloUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform duration-200 border-2 border-white"
        title="Chat Zalo"
      >
        <span className="font-bold text-lg">Zalo</span>
      </a>

      {/* Nút Gọi Điện */}
      <a
        href={`tel:${phoneNumber}`}
        className="relative w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform duration-200"
        title="Gọi Điện"
      >
        <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-75"></div>
        <PhoneIcon />
      </a>
    </div>
  );
}
