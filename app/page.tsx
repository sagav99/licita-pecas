import RadarClient from '@/app/radar-client';

export default function Home() {
  return (
    <RadarClient
      displayName="Marina"
      organizationName="Auto Norte Distribuidora"
      initialCatalogCount={1248}
      initialSaved={[]}
      initialWorkflow={{}}
    />
  );
}
