import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SourcesTab from "@/components/context/SourcesTab";
import BusinessProfileTab from "@/components/context/BusinessProfileTab";
import ContextHealthTab from "@/components/context/ContextHealthTab";

const BusinessContextPage = () => {
  const [activeTab, setActiveTab] = useState("sources");

  return (
    <div className="content-fade-in space-y-6 px-6 py-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Business Context</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Feed your business knowledge to generate smarter, context-aware content.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="profile">Business Profile</TabsTrigger>
          <TabsTrigger value="health">Context Health</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <SourcesTab />
        </TabsContent>
        <TabsContent value="profile">
          <BusinessProfileTab />
        </TabsContent>
        <TabsContent value="health">
          <ContextHealthTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessContextPage;
