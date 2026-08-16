import { useNavigate } from "react-router-dom";

import { Composer } from "@/components/composer";
import { useApp } from "@/context/app-context";

export function ComposerPage() {
  const navigate = useNavigate();
  const { address, pseudonym, setPseudonym, bumpFeedTick } = useApp();

  return (
    <section>
      <Composer
        address={address}
        pseudonym={pseudonym}
        onPseudonymChange={setPseudonym}
        onPosted={() => {
          bumpFeedTick();
          navigate("/feed");
        }}
      />
    </section>
  );
}
