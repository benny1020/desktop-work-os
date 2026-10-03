export const isDesktop = () => !!window.orbit?.invoke;
export async function invoke(action, args = {}) {
  if (!isDesktop())
    throw new Error(
      "실제 서비스 연결은 Electron 앱에서 사용할 수 있습니다. 브라우저에서는 데모를 확인하세요.",
    );
  return window.orbit.invoke(action, args);
}
