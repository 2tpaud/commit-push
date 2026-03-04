import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-foreground">
      <h1 className="mb-6 text-2xl font-bold">CommitPush 서비스 이용약관</h1>
      <p className="mb-8 text-xs text-muted-foreground">
        본 약관은 씨큐브드(C Cubed)가 제공하는 CommitPush 서비스(이하 &quot;서비스&quot;)의 이용과
        관련하여 회사와 이용자 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정합니다.
      </p>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제1조 (목적)</h2>
        <p>
          이 약관은 씨큐브드(C Cubed)(이하 &quot;회사&quot;)가 제공하는 CommitPush 서비스의 이용과
          관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 서비스 이용조건 및 절차 등 기본적인
          사항을 정함을 목적으로 합니다.
        </p>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제2조 (정의)</h2>
        <p>이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            &quot;서비스&quot;라 함은 회사가 제공하는 CommitPush 웹 서비스 및 이에 부수되는 모든
            온라인 서비스를 말합니다.
          </li>
          <li>
            &quot;이용자&quot;라 함은 본 약관에 따라 회사가 제공하는 서비스를 이용하는 모든 회원 및
            비회원을 말합니다.
          </li>
          <li>
            &quot;회원&quot;이라 함은 회사와 이용계약을 체결하고 계정을 발급받아 서비스를 이용하는
            자를 말합니다.
          </li>
          <li>
            &quot;계정&quot;이라 함은 서비스를 이용하기 위하여 필요한 이메일 주소, 외부 인증 정보
            등 식별 정보를 말합니다.
          </li>
          <li>
            &quot;유료 서비스&quot;라 함은 Pro, Team 등 회사가 별도로 정한 요금을 지불해야 이용할
            수 있는 서비스를 말합니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제3조 (약관의 효력 및 변경)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            본 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력이 발생합니다.
          </li>
          <li>
            회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 사전에
            서비스 내 공지사항 등을 통하여 공지합니다.
          </li>
          <li>
            이용자가 변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용하는 경우, 변경된
            약관에 동의한 것으로 봅니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제4조 (이용계약의 체결)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            이용계약은 이용자가 Google OAuth 등 회사가 정한 방식으로 로그인을 완료하고, 본 약관에
            동의함으로써 체결됩니다.
          </li>
          <li>
            회사는 다음 각 호에 해당하는 경우 이용신청을 거부하거나 사후에 이용계약을 해지할 수
            있습니다.
            <ul className="list-[circle] space-y-1 pl-5">
              <li>타인의 명의 또는 허위 정보로 신청한 경우</li>
              <li>서비스 이용을 악의적으로 방해하거나 방해할 우려가 있는 경우</li>
              <li>기타 관련 법령 또는 회사 정책을 위반한 경우</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제5조 (서비스의 제공 및 변경)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            회사는 노트·커밋 관리, 활동 시각화, PushMind RAG 챗봇, 결제 및 요금제 관리 등
            CommitPush에서 정의한 기능을 제공합니다.
          </li>
          <li>
            회사는 서비스의 품질 향상, 보안 강화, 운영상·기술상의 필요에 따라 서비스의 전부 또는
            일부를 수정, 추가, 중단할 수 있으며, 중요한 변경 사항은 사전에 공지합니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제6조 (요금 및 결제)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            서비스의 기본 플랜(Free)은 무료로 제공되며, Pro·Team 등 유료 플랜은 별도의 요금 정책에
            따라 제공됩니다.
          </li>
          <li>
            유료 서비스의 요금, 결제 주기, 환불 조건 등은 서비스 내 요금제(Plan) 안내 페이지 및
            관련 정책에서 정한 바를 따릅니다.
          </li>
          <li>
            이용자는 결제 정보를 정확하게 제공하여야 하며, 결제 수단의 도용·부정 사용 등에 대한
            책임은 이용자 본인에게 있습니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제7조 (이용자의 의무)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>이용자는 관련 법령, 본 약관, 서비스 내 안내사항을 준수하여야 합니다.</li>
          <li>
            이용자는 다음 각 호의 행위를 하여서는 안 됩니다.
            <ul className="list-[circle] space-y-1 pl-5">
              <li>타인의 계정 또는 결제 정보를 무단으로 사용하거나 공유하는 행위</li>
              <li>서비스의 안정적인 운영을 방해하는 행위(과도한 트래픽 유발, 취약점 악용 등)</li>
              <li>법령에 위반되거나 공서양속에 반하는 정보의 저장·공유 행위</li>
              <li>서비스 소스 코드·인프라에 대한 역설계, 무단 크롤링 등 비정상적인 접근 행위</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제8조 (회사의 의무)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>회사는 관련 법령과 본 약관에 따라 서비스를 안정적으로 제공하기 위해 노력합니다.</li>
          <li>
            회사는 이용자의 개인정보를 개인정보 처리방침에서 정한 바에 따라 안전하게 처리하며,
            이용자의 동의 없이 제3자에게 제공하지 않습니다(법령에서 허용하는 경우 제외).
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제9조 (개인정보 보호)</h2>
        <p>
          회사는 서비스를 제공함에 있어 이용자의 개인정보를 적법하게 수집·이용하며, 구체적인
          사항은 별도의{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            개인정보 처리방침
          </Link>
          에 따릅니다.
        </p>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제10조 (서비스의 중단)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            회사는 서비스 설비의 보수, 교체, 고장, 통신두절 또는 운영상 상당한 이유가 있는 경우
            서비스의 전부 또는 일부를 일시적으로 중단할 수 있습니다.
          </li>
          <li>
            회사는 불가피한 사유가 없는 한 서비스 중단 전에 사전에 공지하며, 긴급한 경우 사후에
            공지할 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제11조 (이용계약의 해지)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            이용자는 언제든지 서비스 내 제공되는 방법을 통하여 계정 삭제 등으로 이용계약을 해지할
            수 있습니다.
          </li>
          <li>
            회사는 이용자가 본 약관 또는 관련 법령을 위반한 경우, 사전 통지 후 이용계약을 해지하거나
            서비스 이용을 제한할 수 있습니다. 긴급한 경우에는 사후 통지할 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제12조 (책임의 제한)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            회사는 천재지변, 전쟁, 테러, 해킹, 통신사고 등 회사의 합리적인 통제 범위를 벗어난
            사유로 인한 서비스 장애에 대하여 책임을 지지 않습니다.
          </li>
          <li>
            회사는 이용자가 서비스 내에 저장한 데이터의 손실·훼손 방지를 위해 합리적인 노력을
            다하지만, 백업·관리 의무를 전부 보장하는 것은 아닙니다. 중요한 데이터는 이용자가 별도로
            백업해야 합니다.
          </li>
        </ul>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-semibold">제13조 (준거법 및 분쟁해결)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>이 약관은 대한민국 법령에 따라 해석·적용됩니다.</li>
          <li>
            회사와 이용자 간에 발생한 분쟁에 대해서는 상호 합의를 우선으로 하되, 합의가 이루어지지
            않을 경우 민사소송법에 따른 관할법원에 소를 제기할 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="mb-10 space-y-2">
        <h2 className="font-semibold">제14조 (사업자 정보)</h2>
        <div className="space-y-1">
          <p>상호: 씨큐브드(C Cubed)</p>
          <p>대표자명: 이세명</p>
          <p>사업자등록번호: 781-47-00894</p>
          <p>주소: 경기도 이천시 백사면 원적로617번길 150-18</p>
          <p>이메일: 2tpaud@gmail.com</p>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">시행일자: 2026-02-16</p>
    </div>
  )
}

