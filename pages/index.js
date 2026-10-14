import Head from "next/head";

function Home() {
  return (
    <>
      <Head>
        <title>Central</title>
        <meta name="application-name" content="Central" />
        <meta
          name="description"
          content="Central: gerenciamento de chamados e solicitações para empresas e equipes de atendimento."
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <h1>Central</h1>
    </>
  );
}

export default Home;
