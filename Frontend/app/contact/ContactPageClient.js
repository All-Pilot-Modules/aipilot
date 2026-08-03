"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Github,
  Send,
  HelpCircle,
  Bug,
  Lightbulb
} from "lucide-react";
import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real app, this would send to an API
    console.log("Form submitted:", formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/10 dark:to-purple-950/10">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">AI</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">AI Education Pilot</span>
            </Link>
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-6 px-4 py-2 text-sm font-semibold">
            <MessageSquare className="w-4 h-4 mr-2 text-blue-500" />
            Get in Touch
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Contact
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Our Team
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Have questions, suggestions, or need help? We&apos;d love to hear from you!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Contact Form */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Send us a message</h2>

              {submitted && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 font-medium">
                    ✓ Message sent! We&apos;ll get back to you soon.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder="What's this about?"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us more..."
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="mt-2"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Options */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Email Us</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      For general inquiries and support
                    </p>
                    <a href="mailto:support@aieducationpilot.com" className="text-blue-600 hover:underline font-medium">
                      support@aieducationpilot.com
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Github className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">GitHub Issues</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Report bugs or request features
                    </p>
                    <Button asChild variant="outline">
                      <Link href="https://github.com/All-Pilot-Modules/ai-pilot/issues" target="_blank">
                        <Github className="w-4 h-4 mr-2" />
                        Open an Issue
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Common Topics</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <HelpCircle className="w-5 h-5 text-blue-500" />
                    <span>General support and questions</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Bug className="w-5 h-5 text-red-500" />
                    <span>Bug reports and issues</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    <span>Feature requests and suggestions</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Github className="w-5 h-5 text-purple-500" />
                    <span>Contributing to the project</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Section */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Is AI Education Pilot really free?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Yes! AI Education Pilot is 100% free and open source under the MIT License. You can use it, modify it, and even sell services based on it without any fees.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Can I self-host this platform?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Absolutely! Download the source code from GitHub and deploy it on your own servers. You have complete control over your data.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">How do I report a bug?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Please open an issue on our <Link href="https://github.com/All-Pilot-Modules/ai-pilot/issues" className="text-blue-600 hover:underline">GitHub repository</Link>. Include steps to reproduce the issue and any error messages.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Can I contribute to the project?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Yes! We welcome contributions. Check out our <Link href="https://github.com/All-Pilot-Modules/ai-pilot" className="text-blue-600 hover:underline">GitHub repository</Link> for contribution guidelines.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 border-t border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-sm">
            <p>© 2024 AI Education Pilot. Open source and free forever.</p>
            <div className="mt-4 space-x-6">
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
