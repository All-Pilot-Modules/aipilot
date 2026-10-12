export default function TempPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Temporary Page</h1>
        <p className="text-muted-foreground">This is a temporary placeholder page.</p>
      </div>
    </div>
  );
}

// "use client"
// import { AppSidebar } from "@/components/app-sidebar"
// import { ChartAreaInteractive } from "@/components/chart-area-interactive"
// import { DataTable } from "@/components/data-table"
// import { SectionCards } from "@/components/section-cards"
// import { SiteHeader } from "@/components/site-header"
// import { ModeToggle } from "@/components/mode-toggle"
// import {
//   SidebarInset,
//   SidebarProvider,
// } from "@/components/ui/sidebar"

// import data from "./data.json"

// export default function Page() {
//   return (

//       (
//         <SidebarProvider
//       style={
//         {
//           "--sidebar-width": "calc(var(--spacing) * 72)",
//           "--header-height": "calc(var(--spacing) * 12)"
//         }
//       }>
//         {/* Real Sidebar for the application */}
//       <AppSidebar variant="inset" />

//       <SidebarInset>
//         <SiteHeader />
//         <div className="flex flex-1 flex-col">
//           <div className="@container/main flex flex-1 flex-col gap-2">
//             <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
//               {/* <SectionCards /> */}
//               <div className="px-4 lg:px-6">
//                 {/* <ChartAreaInteractive /> */}
//               </div>
//               {/* <DataTable data={data} /> */}
//             </div>
//           </div>
//         </div>
//       </SidebarInset>
//     </SidebarProvider>
//     )


//   );
// }
