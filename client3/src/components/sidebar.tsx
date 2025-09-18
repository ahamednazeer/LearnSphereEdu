import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, BookOpen, FileText, MessageCircle, User, Settings, 
  GraduationCap, PlusCircle, BarChart3 
} from "lucide-react";

export default function Sidebar() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  const studentNavigation = [
    { name: "Dashboard", icon: Home, path: "/dashboard" },
    { name: "My Courses", icon: BookOpen, path: "/courses" },
    { name: "Assessments", icon: FileText, path: "/assessments" },
    { name: "Grades", icon: GraduationCap, path: "/grades" },
    { name: "Discussions", icon: MessageCircle, path: "/discussions" },
  ];

  const teacherNavigation = [
    { name: "Dashboard", icon: Home, path: "/dashboard" },
    { name: "My Courses", icon: BookOpen, path: "/courses" },
    { name: "Create Course", icon: PlusCircle, path: "/courses/create" },
    { name: "Assessments", icon: FileText, path: "/assessments" },
    { name: "Analytics", icon: BarChart3, path: "/analytics" },
    { name: "Discussions", icon: MessageCircle, path: "/discussions" },
  ];

  const accountNavigation = [
    { name: "Profile", icon: User, path: "/profile" },
    { name: "Settings", icon: Settings, path: "/settings" },
  ];

  const navigation = user?.role === "teacher" ? teacherNavigation : studentNavigation;

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:pt-16">
      <div className="flex-1 flex flex-col min-h-0 bg-card border-r border-border">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <span className="text-sm font-medium text-muted-foreground">MAIN MENU</span>
          </div>
          
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start ${
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => setLocation(item.path)}
                  data-testid={`sidebar-${item.name.toLowerCase().replace(" ", "-")}`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Button>
              );
            })}
            
            <div className="pt-4 mt-4 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground px-2">ACCOUNT</span>
            </div>
            
            {accountNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  className={`w-full justify-start ${
                    isActive 
                      ? "bg-muted text-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => setLocation(item.path)}
                  data-testid={`sidebar-${item.name.toLowerCase()}`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
