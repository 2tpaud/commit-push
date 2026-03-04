import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-foreground">
      <h1 className="mb-6 text-2xl font-bold">CommitPush 개인정보 처리방침</h1>
      <p className="mb-8 text-xs text-muted-foreground">
        씨큐브드(C Cubed)(이하 &quot;회사&quot;)는 CommitPush 서비스(이하 &quot;서비스&quot;)를
        제공함에 있어 이용자의 개인정보를 중요하게 생각하며, 개인정보 보호 관련 법령을 준수하고
        있습니다. 본 개인정보 처리방침은 회사가 어떤 정보를, 어떤 목적으로, 어떻게 처리하는지에
        대해 설명합니다.
      </p>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">1. 수집하는 개인정보 항목</h2>
        <p>회사는 다음과 같은 개인정보를 수집할 수 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            회원 가입 및 로그인 시: Google OAuth를 통한 이메일 주소, 이름(프로필 이름), 프로필
            이미지 URL 등 기본 계정 정보
          </li>
          <li>
            서비스 이용 과정에서 자동으로 생성되는 정보: 서비스 이용 기록, 접속 로그, 결제·청구
            이력, 오류 로그 등
          </li>
          <li>
            유료 결제 시: 결제 금액, 결제 수단 종류, 결제 승인/취소 기록 등 결제에 필요한 최소한의
            정보 (실제 카드 번호 등 민감한 정보는 PG사에서 처리하며, 회사는 직접 저장하지
            않습니다.)
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">2. 개인정보의 수집 및 이용 목적</h2>
        <p>회사는 수집한 개인정보를 다음의 목적을 위해 이용합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>서비스 제공 및 계정 관리 (노트·커밋 관리, 활동 시각화, PushMind 기능 등)</li>
          <li>요금제 관리 및 결제·환불 처리, 청구 내역 제공</li>
          <li>서비스 이용 통계, 품질 개선, 오류 분석 등 운영 및 서비스 개선</li>
          <li>부정 이용 방지, 보안 강화, 계정 도용 방지</li>
          <li>법령상 의무 이행(세무, 회계, 보관 의무 등)</li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">3. 개인정보의 보유 및 이용 기간</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            기본적으로 이용자의 개인정보는 서비스 이용 기간 동안 보유·이용되며, 계정 삭제 또는
            이용계약 해지 시 지체 없이 파기합니다.
          </li>
          <li>
            단, 관계 법령에 따라 일정 기간 보관이 필요한 경우 해당 법령에서 정한 기간 동안 보관할
            수 있습니다.
            <ul className="list-[circle] space-y-1 pl-5">
              <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
              <li>대금 결제 및 재화 등의 공급에 관한 기록: 5년</li>
              <li>소비자 불만 또는 분쟁 처리에 관한 기록: 3년</li>
              <li>접속 로그 등 서비스 이용 기록: 3년(보안 목적)</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">4. 개인정보의 제3자 제공</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만, 다음의
            경우에는 예외로 합니다.
            <ul className="list-[circle] space-y-1 pl-5">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 따라 수사기관, 법원 등의 요청이 있는 경우</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">5. 개인정보 처리의 위탁</h2>
        <p>
          회사는 서비스 제공을 위하여 다음과 같이 일부 개인정보 처리를 외부 전문업체에 위탁할 수
          있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>인프라 및 데이터베이스: Supabase (인증·데이터베이스·파일 저장 등)</li>
          <li>결제 처리: 나이스페이(NicePay) 등 결제대행사</li>
          <li>AI 기능: OpenAI 등 LLM·임베딩 API 제공사</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          위탁 업체 및 범위는 기술·운영상 필요에 따라 변경될 수 있으며, 변경 시 서비스 내 공지를
          통해 안내합니다.
        </p>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">6. 이용자의 권리와 행사 방법</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            이용자는 언제든지 서비스 내 제공되는 기능 또는 이메일 문의를 통해 자신의 개인정보에
            대한 열람·정정·삭제·처리정지 등을 요청할 수 있습니다.
          </li>
          <li>
            회사는 관련 법령에서 정한 바에 따라 이용자의 요청을 지체 없이 처리하며, 부득이하게
            거절·제한하는 경우 그 사유를 안내합니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">7. 쿠키(Cookie)의 사용</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            회사는 로그인 상태 유지, 서비스 이용 편의성 향상, 보안 강화를 위해 쿠키 및 유사
            기술을 사용할 수 있습니다.
          </li>
          <li>
            이용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있으나, 이 경우 서비스
            이용에 일부 제한이 있을 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">8. 개인정보의 안전성 확보 조치</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>접근 권한 관리, 암호화, 로그 모니터링 등 기술적·관리적 보호조치를 시행합니다.</li>
          <li>
            개인정보 접근 권한을 최소한의 인원으로 제한하고, 정기적인 점검을 통해 안전한 운영을
            위해 노력합니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">9. 제3자 서비스 및 외부 링크</h2>
        <p>
          서비스 내에서 제공되는 외부 웹사이트, 링크, 제3자 서비스(예: Google Drive, GitHub 등)는
          회사와 별개의 개인정보 처리방침을 가질 수 있으며, 이에 대해서는 해당 제공자의 정책이
          적용됩니다.
        </p>
      </section>

      <section className="mb-8 space-y-2">
        <h2 className="font-semibold">10. 개인정보 보호책임자 및 문의처</h2>
        <p>개인정보 보호 관련 문의, 불만 처리, 피해 구제 등은 아래로 연락해 주시기 바랍니다.</p>
        <div className="space-y-1">
          <p>상호: 씨큐브드(C Cubed)</p>
          <p>대표자명: 이세명</p>
          <p>이메일: 2tpaud@gmail.com</p>
          <p>주소: 경기도 이천시 백사면 원적로617번길 150-18</p>
        </div>
      </section>

      <p className="mb-2 text-xs text-muted-foreground">
        본 개인정보 처리방침은 서비스 이용약관과 함께 적용되며, 약관 내용은{' '}
        <Link href="/terms" className="underline underline-offset-4">
          서비스 이용약관
        </Link>
        을 참고하시기 바랍니다.
      </p>

      <p className="text-xs text-muted-foreground">시행일자: 2026-02-16</p>
    </div>
  )
}

