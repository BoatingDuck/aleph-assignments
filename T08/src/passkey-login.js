// These are browser discovery hints, never a replacement for server verification.
export function phoneAuthenticationOptions(options) {
  return {
    ...options,
    hints: ['hybrid'],
    timeout: 120_000,
    // Keep the selected account's credential IDs. Omit transport hints in this
    // explicit cross-device flow so old internal/USB metadata cannot hide phones.
    ...(options.allowCredentials ? {
      allowCredentials: options.allowCredentials.map(({transports, ...credential}) => credential),
    } : {}),
  };
}

export function passkeyErrorMessage(error, registration=false) {
  const name = error.cause?.name || error.name;
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return registration
      ? '패스키 등록이 완료되지 않았습니다. 취소·시간 초과 또는 기기 연결 문제일 수 있습니다. 새 패스키 저장 요청은 전송되지 않았습니다.'
      : '패스키 인증을 완료하지 못했습니다. 취소·시간 초과 또는 기기 연결 문제일 수 있습니다. 휴대폰의 패스키는 ‘휴대폰 패스키로 로그인’으로 시도하고, PC와 휴대폰의 Bluetooth 및 선택한 계정을 확인하세요. QR 선택지가 없으면 이 PC·브라우저가 휴대폰 인증을 지원하는지 확인하세요.';
  }
  return error.message || '패스키 처리 중 오류가 발생했습니다.';
}
