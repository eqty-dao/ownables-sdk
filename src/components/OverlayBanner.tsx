export function OverlayBanner(props: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <div className="w-full text-center">
        <div
          className="w-[120%] -ml-[10%] rotate-[-10deg] bg-slate-900 py-1 text-[28px] text-white"
          style={{ cursor: "default", userSelect: "none" }}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}
